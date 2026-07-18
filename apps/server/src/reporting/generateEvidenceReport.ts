import { mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  EvidenceReportResultSchema,
  EvidenceReportSchema,
  type CompatibilityRepairResult,
  type DependencyUpdateResult,
  type EvidenceItem,
  type EvidenceReport,
  type EvidenceReportResult,
  type InvestigationResult,
  type IsolationRun,
  type RemediationProposal,
  type TargetedTestResult,
  type VerificationResult,
} from "@patchpilot/contracts";

const disclaimer = "Verified checks reduce uncertainty but do not certify exploitability, compliance, or security." as const;

function within(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

async function validateRepositoryFile(root: string, file: string): Promise<string> {
  if (path.isAbsolute(file)) throw new Error(`Report file reference must be repository-relative: ${file}`);
  const candidate = await realpath(path.resolve(root, file));
  if (!within(root, candidate)) throw new Error(`Report file reference escapes the repository: ${file}`);
  if (!(await stat(candidate)).isFile()) throw new Error(`Report file reference is not a file: ${file}`);
  return candidate;
}

async function validateEvidenceReferences(repositoryPath: string, investigation: InvestigationResult): Promise<void> {
  const repositoryRoot = await realpath(repositoryPath);
  const knownFiles = new Set(investigation.evidence.searchedFiles);
  const ids = new Set<string>();

  for (const item of investigation.evidence.items) {
    if (ids.has(item.id)) throw new Error(`Duplicate evidence ID: ${item.id}`);
    ids.add(item.id);
    if (!item.file) continue;
    if (!knownFiles.has(item.file)) throw new Error(`Evidence file was not included in the bounded search: ${item.file}`);
    const filePath = await validateRepositoryFile(repositoryRoot, item.file);
    const lines = (await readFile(filePath, "utf8")).split(/\r?\n/);
    const excerpt = lines.slice((item.startLine ?? 1) - 1, item.endLine).join("\n");
    if (excerpt !== item.excerpt) throw new Error(`Evidence excerpt no longer matches ${item.file}:${item.startLine}-${item.endLine}`);
  }

  const assessment = investigation.assessmentRun.assessment;
  for (const id of [...assessment.supportingEvidenceIds, ...assessment.counterEvidenceIds]) {
    if (!ids.has(id)) throw new Error(`Affectedness assessment references unknown evidence ID: ${id}`);
  }
}

async function validateChangedFiles(repositoryPath: string, files: string[]): Promise<void> {
  const repositoryRoot = await realpath(repositoryPath);
  for (const file of files) await validateRepositoryFile(repositoryRoot, file);
}

function inline(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function bullets(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function evidenceLocation(item: EvidenceItem): string {
  return item.file ? `${item.file}:${item.startLine}-${item.endLine}` : "bounded repository search";
}

export function renderEvidenceReportMarkdown(report: EvidenceReport): string {
  const facts = report.deterministicFacts;
  const interpretation = report.modelInterpretation;
  const assessment = interpretation.affectedness.assessment;
  const plan = interpretation.remediationPlan.plan;
  const approval = report.humanDecision;
  const rescan = facts.rescan;
  const commandRows = facts.commands.map((command) =>
    `| ${inline(command.phase)} | ${inline(command.kind)} | \`${inline(command.command)}\` | ${command.status} | ${command.exitCode} | ${command.durationMs} ms |`,
  ).join("\n");
  const evidenceSections = facts.evidence.map((item) => {
    const excerpt = item.excerpt ? `\n\n\`\`\`\`text\n${item.excerpt}\n\`\`\`` : "";
    return `### ${item.id} — DETERMINISTIC FACT\n\n- Type: ${item.type}\n- Reference: \`${evidenceLocation(item)}\`\n- Explanation: ${item.explanation}${excerpt}`;
  }).join("\n\n");
  const selectedState = rescan ? (rescan.selectedAdvisoryPresent ? "present" : "absent") : "not reached";

  return `# PatchPilot Evidence Report

> Report ${report.reportId} · schema ${report.schemaVersion}

## Final Status — DETERMINISTIC FACT

**${report.finalStatus.status.toUpperCase()}** — ${report.finalStatus.summary}

- Selected advisory after patch: **${selectedState}**
- Source checkout clean: **${facts.sourceCheckoutClean ? "yes" : "no"}**
- Generated: ${report.generatedAt}

## Original Finding — DETERMINISTIC FACT

- Advisory: **${facts.finding.id}** (${facts.finding.aliases.join(", ")})
- Package: **${facts.finding.packageName}@${facts.finding.installedVersion}**
- Dependency: ${facts.finding.direct ? "direct" : "transitive"} npm dependency
- Manifest: \`${facts.finding.manifestPath}\`
- Lockfile: \`${facts.finding.lockfilePath ?? "not recorded"}\`
- Affected range: ${facts.finding.affectedRanges.join(", ")}
- Fixed versions: ${facts.finding.fixedVersions.join(", ")}
- Summary: ${facts.finding.summary}

## Repository Evidence — DETERMINISTIC FACT

${evidenceSections}

## Affectedness Assessment — MODEL INTERPRETATION

- Model: ${interpretation.affectedness.model}
- Source: ${interpretation.affectedness.source}
- Verdict: **${assessment.verdict}**
- Confidence: **${assessment.confidence}**
- Supporting evidence: ${assessment.supportingEvidenceIds.map((id) => `\`${id}\``).join(", ")}
- Counter-evidence: ${assessment.counterEvidenceIds.map((id) => `\`${id}\``).join(", ")}

${assessment.rationale}

## Human Approval — HUMAN DECISION

- Decision: **${approval.decision}**
- Plan: \`${approval.planId}\`
- Recorded: ${approval.recordedAt}

No repository write occurred before this explicit approval record.

## Approved Remediation Plan — MODEL INTERPRETATION

- Model: ${interpretation.remediationPlan.model}
- Source: ${interpretation.remediationPlan.source}
- Strategy: **${plan.strategy}**
- Target: **json5 ${plan.targetVersion}**
- Expected files: ${plan.expectedFiles.map((file) => `\`${file}\``).join(", ")}

${plan.explanation}

### Expected compatibility risks

${bullets(plan.expectedCompatibilityRisks)}

## Files Changed — DETERMINISTIC FACT

${bullets(facts.patch.changedFiles.map((file) => `\`${file}\``))}

### Dependency Changes — DETERMINISTIC FACT

- ${facts.patch.dependency.packageName}: **${facts.patch.dependency.fromVersion} → ${facts.patch.dependency.toVersion}**
- Files: ${facts.patch.dependency.files.map((file) => `\`${file}\``).join(", ")}

\`\`\`\`diff
${facts.patch.dependency.diff}
\`\`\`\`

### Source Change — DETERMINISTIC FACT

- File: \`${facts.patch.source.file}\`
- Model interpretation used for the bounded replacement: ${interpretation.compatibilityRepair.model} (${interpretation.compatibilityRepair.source})

\`\`\`\`diff
${facts.patch.source.diff}
\`\`\`\`

### Test Added or Changed — DETERMINISTIC FACT

- File: \`${facts.patch.test.file}\`
- Test: **${facts.patch.test.name}**
- Model interpretation used to propose the test: ${interpretation.targetedTest.model} (${interpretation.targetedTest.source})

\`\`\`\`diff
${facts.patch.test.diff}
\`\`\`\`

## Command Results — DETERMINISTIC FACT

| Phase | Kind | Command | Status | Exit | Duration |
| --- | --- | --- | --- | ---: | ---: |
${commandRows}

## Rescan Result — DETERMINISTIC FACT

${rescan ? `- Scanner: OSV-Scanner ${rescan.scannerVersion}\n- Scanned: ${rescan.scannedAt}\n- Normalized findings: ${rescan.findingCount}\n- Selected advisory ${rescan.selectedAdvisoryId}: **${rescan.selectedAdvisoryPresent ? "present" : "absent"}**` : "Rescan was not reached; the report makes no clean-rescan claim."}

## Remaining Uncertainty — UNCERTAINTY

### Affectedness unknowns

${bullets(report.uncertainty.affectednessUnknowns)}

### Limitations

${bullets(report.uncertainty.limitations)}

### Compatibility unknowns

${bullets(report.uncertainty.compatibilityUnknowns)}

### Targeted-test unknowns

${bullets(report.uncertainty.testUnknowns)}

### Recommended next checks

${bullets(report.uncertainty.recommendedNextChecks)}

> ${report.uncertainty.disclaimer}
`;
}

export async function generateEvidenceReport(options: {
  investigation: InvestigationResult;
  proposal: RemediationProposal;
  isolationRun: IsolationRun;
  dependencyUpdate: DependencyUpdateResult;
  compatibilityRepair: CompatibilityRepairResult;
  targetedTest: TargetedTestResult;
  verification: VerificationResult;
  sourceRepositoryPath: string;
  resultRoot: string;
  now?: Date;
}): Promise<EvidenceReportResult> {
  const { investigation, proposal, isolationRun, dependencyUpdate, compatibilityRepair, targetedTest, verification } = options;
  if (proposal.status !== "approved" || !proposal.approval) throw new Error("Evidence report requires explicit human approval");
  if (compatibilityRepair.status !== "repaired" || targetedTest.status !== "test_added_passed") {
    throw new Error("Evidence report requires the retained approved source and test changes");
  }
  const identifiers = [proposal.id, isolationRun.planId, dependencyUpdate.planId, compatibilityRepair.planId, targetedTest.planId, verification.planId];
  if (identifiers.some((id) => id !== proposal.id)) throw new Error("Evidence chain plan IDs do not match");
  const runIds = [isolationRun.id, dependencyUpdate.runId, compatibilityRepair.runId, targetedTest.runId, verification.runId];
  if (runIds.some((id) => id !== isolationRun.id)) throw new Error("Evidence chain run IDs do not match");
  if (investigation.finding.id !== verification.selectedAdvisoryId) throw new Error("Original finding does not match the verified advisory");

  await validateEvidenceReferences(options.sourceRepositoryPath, investigation);
  await validateChangedFiles(isolationRun.isolatedRepositoryPath, verification.changedFiles);

  const generatedAt = (options.now ?? new Date()).toISOString();
  const finalStatus = verification.status === "verified"
    ? {
        status: "verified" as const,
        selectedAdvisoryPresent: false,
        summary: "The approved four-file patch passed baseline and post-patch checks, and the selected advisory is absent from the normalized OSV rescan.",
      }
    : {
        status: "failed" as const,
        selectedAdvisoryPresent: verification.rescan?.selectedAdvisoryPresent ?? null,
        summary: verification.failure?.summary ?? "Verification failed without a clean final claim.",
      };
  const report = EvidenceReportSchema.parse({
    schemaVersion: "1.0",
    reportId: `report-${isolationRun.id}`,
    runId: isolationRun.id,
    planId: proposal.id,
    generatedAt,
    deterministicFacts: {
      finding: investigation.finding,
      evidence: investigation.evidence.items,
      patch: {
        changedFiles: verification.changedFiles,
        dependency: {
          packageName: dependencyUpdate.packageName,
          fromVersion: dependencyUpdate.fromVersion,
          toVersion: dependencyUpdate.targetVersion,
          files: dependencyUpdate.changedFiles,
          diff: dependencyUpdate.diff,
        },
        source: { file: compatibilityRepair.file, diff: compatibilityRepair.sourceDiff },
        test: {
          file: targetedTest.file,
          name: targetedTest.proposalRun.proposal.testName,
          diff: targetedTest.testDiff,
        },
      },
      commands: verification.commands,
      rescan: verification.rescan,
      sourceCheckoutClean: verification.sourceCheckoutClean,
    },
    modelInterpretation: {
      affectedness: investigation.assessmentRun,
      remediationPlan: proposal.planRun,
      compatibilityRepair: compatibilityRepair.attempts.at(-1)?.proposalRun,
      targetedTest: targetedTest.proposalRun,
    },
    humanDecision: proposal.approval,
    uncertainty: {
      affectednessUnknowns: investigation.assessmentRun.assessment.unknowns,
      limitations: investigation.assessmentRun.assessment.limitations,
      compatibilityUnknowns: compatibilityRepair.attempts.at(-1)?.proposalRun.proposal.remainingUnknowns,
      testUnknowns: targetedTest.proposalRun.proposal.remainingUnknowns,
      recommendedNextChecks: investigation.assessmentRun.assessment.recommendedNextChecks,
      disclaimer,
    },
    finalStatus,
  });
  const markdown = renderEvidenceReportMarkdown(report);
  await mkdir(options.resultRoot, { recursive: true });
  const basename = `${isolationRun.id}-report`;
  await Promise.all([
    writeFile(path.join(options.resultRoot, `${basename}.json`), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 }),
    writeFile(path.join(options.resultRoot, `${basename}.md`), markdown, { mode: 0o600 }),
  ]);

  return EvidenceReportResultSchema.parse({
    runId: isolationRun.id,
    planId: proposal.id,
    status: "reported",
    report,
    markdown,
    reportPaths: {
      markdown: `runs/audit/${basename}.md`,
      json: `runs/audit/${basename}.json`,
    },
    completedAt: generatedAt,
  });
}

export class EvidenceReportStore {
  readonly #byRun = new Map<string, EvidenceReportResult>();

  register(result: EvidenceReportResult): EvidenceReportResult {
    const parsed = EvidenceReportResultSchema.parse(result);
    this.#byRun.set(parsed.runId, parsed);
    return parsed;
  }

  getByRun(runId: string): EvidenceReportResult | undefined {
    return this.#byRun.get(runId);
  }
}
