import { execFile } from "node:child_process";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
  EvidenceReportResultSchema,
  GitHandoffResultSchema,
  IsolationRunSchema,
  type EvidenceReportResult,
  type GitHandoffResult,
  type IsolationRun,
} from "@patchpilot/contracts";
import { canonicalExistingPath, resolveInsideBoundary } from "../remediation/isolateRepository.js";

const execFileAsync = promisify(execFile);
const gitTimeoutMs = 10_000;
const gitMaxBufferBytes = 1024 * 1024;
const commitMessage = "fix: remediate GHSA-9c47-m6qq-7p4h in json5" as const;
const changedFiles = ["package-lock.json", "package.json", "src/theme.js", "test/theme.test.js"] as const;
const publicationReason = "The bundled demo has no publication remote. Push and draft PR creation require a separate explicit approval and configured target." as const;

async function git(gitRoot: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", gitRoot, ...args], {
    encoding: "utf8",
    timeout: gitTimeoutMs,
    maxBuffer: gitMaxBufferBytes,
  });
  return stdout.trimEnd();
}

function lines(value: string): string[] {
  return value ? value.split("\n").filter(Boolean) : [];
}

function assertExactFiles(actual: string[], label: string): void {
  const sorted = [...actual].sort();
  if (JSON.stringify(sorted) !== JSON.stringify(changedFiles)) {
    throw new Error(`${label} must contain exactly the approved four files; found: ${sorted.join(", ") || "none"}`);
  }
}

function bulletList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

export function renderPullRequestBody(reportResult: EvidenceReportResult): string {
  const report = reportResult.report;
  const facts = report.deterministicFacts;
  const model = report.modelInterpretation;
  const commandRows = facts.commands.map((command) =>
    `- \`${command.command}\` — ${command.status}, exit ${command.exitCode}, ${command.durationMs} ms`,
  );
  const limitations = [
    ...report.uncertainty.limitations,
    ...report.uncertainty.compatibilityUnknowns,
    ...report.uncertainty.testUnknowns,
  ];

  return `## Summary

- Remediates ${facts.finding.id} in ${facts.finding.packageName} by upgrading ${facts.patch.dependency.fromVersion} → ${facts.patch.dependency.toVersion}.
- Retains the human-approved compatibility repair and one benign targeted regression test.
- Changes exactly: ${facts.patch.changedFiles.map((file) => `\`${file}\``).join(", ")}.

## Deterministic evidence

- Baseline tests and build passed before applying the retained patch.
- Post-patch targeted test, full tests, and build passed.
- OSV-Scanner ${facts.rescan?.scannerVersion ?? "unknown"} normalized ${facts.rescan?.findingCount ?? "unknown"} finding(s); ${facts.finding.id} is ${facts.rescan?.selectedAdvisoryPresent === false ? "absent" : "not proven absent"}.
- Source checkout remained clean throughout the isolated run.

## Human approval

- Approved plan: \`${report.planId}\`
- Decision: ${report.humanDecision.decision}
- Recorded: ${report.humanDecision.recordedAt}

## Verification commands

${commandRows.join("\n")}

## Model and Codex contribution

- Affectedness interpretation: ${model.affectedness.model}, source \`${model.affectedness.source}\`, verdict **${model.affectedness.assessment.verdict}** with **${model.affectedness.assessment.confidence}** confidence.
- Remediation planning: ${model.remediationPlan.model}, source \`${model.remediationPlan.source}\`.
- Compatibility repair proposal: ${model.compatibilityRepair.model}, source \`${model.compatibilityRepair.source}\`.
- Targeted-test proposal: ${model.targetedTest.model}, source \`${model.targetedTest.source}\`.
- PatchPilot was built and iterated with Codex. In this run, deterministic approval-gated PatchPilot executors performed repository writes; model output remained interpretation and bounded proposals.

## Remaining uncertainty and limitations

${bulletList(limitations)}

${report.uncertainty.disclaimer}

## Review artifacts

- Markdown evidence: \`${reportResult.reportPaths.markdown}\`
- JSON evidence: \`${reportResult.reportPaths.json}\`
- Git handoff audit: \`runs/audit/${report.runId}-github-handoff.json\`

## Publication state

Remote publication was not requested. Push and draft PR creation require separate explicit approval and a configured publication remote. This copy is prepared for a draft pull request; it does not claim that one was opened.
`;
}

export async function createGitHandoff(options: {
  evidenceReport: EvidenceReportResult;
  isolationRun: IsolationRun;
  boundaryRoot: string;
  resultRoot: string;
  now?: Date;
}): Promise<GitHandoffResult> {
  const evidenceReport = EvidenceReportResultSchema.parse(options.evidenceReport);
  const isolationRun = IsolationRunSchema.parse(options.isolationRun);
  if (evidenceReport.runId !== isolationRun.id || evidenceReport.planId !== isolationRun.planId) {
    throw new Error("Evidence report does not match the isolated approved run");
  }
  if (evidenceReport.report.finalStatus.status !== "verified" || evidenceReport.report.finalStatus.selectedAdvisoryPresent !== false) {
    throw new Error("Git handoff requires a verified report with the selected advisory absent");
  }
  if (evidenceReport.report.humanDecision.decision !== "approved") {
    throw new Error("Git handoff requires the matching explicit human approval");
  }

  const requestedBoundaryRoot = path.resolve(options.boundaryRoot);
  const boundaryRoot = await realpath(requestedBoundaryRoot);
  const sourceGitRoot = await canonicalExistingPath(boundaryRoot, isolationRun.sourceGitRoot, "Source Git root");
  const worktreePath = await canonicalExistingPath(boundaryRoot, isolationRun.worktreePath, "Isolated worktree");
  const isolatedRepositoryPath = await canonicalExistingPath(worktreePath, isolationRun.isolatedRepositoryPath, "Isolated repository");
  const repositoryPrefix = path.relative(worktreePath, isolatedRepositoryPath);
  const prefix = repositoryPrefix === "" ? "" : `${repositoryPrefix}/`;
  const requestedResultRoot = resolveInsideBoundary(requestedBoundaryRoot, options.resultRoot, "Git handoff result root");
  const resultRoot = resolveInsideBoundary(boundaryRoot, path.join(boundaryRoot, path.relative(requestedBoundaryRoot, requestedResultRoot)), "Git handoff result root");
  const resultPath = resolveInsideBoundary(resultRoot, path.join(resultRoot, `${isolationRun.id}-github-handoff.json`), "Git handoff result path");
  await mkdir(resultRoot, { recursive: true });

  const sourceStatus = await git(sourceGitRoot, ["status", "--porcelain=v1", "--untracked-files=all"]);
  if (sourceStatus) throw new Error("Source checkout must remain clean before Git handoff");
  if (await git(worktreePath, ["branch", "--show-current"]) !== isolationRun.branchName) {
    throw new Error("Isolated worktree branch no longer matches the approved run");
  }
  if (await git(worktreePath, ["rev-parse", "HEAD"]) !== isolationRun.baselineCommit) {
    throw new Error("Isolated worktree HEAD moved after verification");
  }

  const statusFiles = lines(await git(worktreePath, ["status", "--porcelain=v1", "--untracked-files=all"]))
    .map((line) => line.slice(3))
    .map((file) => prefix && file.startsWith(prefix) ? file.slice(prefix.length) : file);
  assertExactFiles(statusFiles, "Uncommitted handoff diff");

  await git(worktreePath, ["add", "--", ...changedFiles.map((file) => `${prefix}${file}`)]);
  const stagedFiles = lines(await git(worktreePath, ["diff", "--cached", "--name-only", "--diff-filter=ACMR"]))
    .map((file) => prefix && file.startsWith(prefix) ? file.slice(prefix.length) : file);
  assertExactFiles(stagedFiles, "Staged handoff diff");

  await git(worktreePath, [
    "-c", "core.hooksPath=/dev/null",
    "-c", "user.name=PatchPilot",
    "-c", "user.email=patchpilot@example.invalid",
    "commit", "--no-gpg-sign", "--no-verify", "-m", commitMessage,
  ]);

  const sha = await git(worktreePath, ["rev-parse", "HEAD"]);
  const parent = await git(worktreePath, ["rev-parse", "HEAD^"]);
  if (sha === isolationRun.baselineCommit || parent !== isolationRun.baselineCommit) {
    throw new Error("Local patch commit does not descend directly from the verified baseline");
  }
  if (await git(worktreePath, ["branch", "--show-current"]) !== isolationRun.branchName) {
    throw new Error("Local patch commit changed the approved branch");
  }
  if (await git(worktreePath, ["log", "-1", "--format=%s"]) !== commitMessage) {
    throw new Error("Local patch commit message does not match the review handoff contract");
  }
  const committedFiles = lines(await git(worktreePath, ["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"]))
    .map((file) => prefix && file.startsWith(prefix) ? file.slice(prefix.length) : file);
  assertExactFiles(committedFiles, "Local patch commit");
  if (await git(worktreePath, ["status", "--porcelain=v1", "--untracked-files=all"])) {
    throw new Error("Isolated worktree must be clean after the local patch commit");
  }
  if (await git(sourceGitRoot, ["status", "--porcelain=v1", "--untracked-files=all"])) {
    throw new Error("Source checkout changed during Git handoff");
  }

  const completedAt = (options.now ?? new Date()).toISOString();
  const result = GitHandoffResultSchema.parse({
    runId: isolationRun.id,
    planId: isolationRun.planId,
    status: "local_commit_ready",
    commit: { sha, parent, branchName: isolationRun.branchName, message: commitMessage, changedFiles },
    pullRequestDraft: {
      title: commitMessage,
      body: renderPullRequestBody(evidenceReport),
      baseBranch: isolationRun.sourceBranch,
      headBranch: isolationRun.branchName,
      draft: true,
    },
    remotePublication: { status: "not_requested", requiresExplicitApproval: true, reason: publicationReason },
    sourceCheckoutClean: true,
    resultLogPath: `runs/audit/${isolationRun.id}-github-handoff.json`,
    completedAt,
  });

  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  return result;
}

export class GitHandoffStore {
  readonly #byRun = new Map<string, GitHandoffResult>();

  register(result: GitHandoffResult): GitHandoffResult {
    const parsed = GitHandoffResultSchema.parse(result);
    const existing = this.#byRun.get(parsed.runId);
    if (existing) return existing;
    this.#byRun.set(parsed.runId, parsed);
    return parsed;
  }

  getByRun(runId: string): GitHandoffResult | undefined {
    return this.#byRun.get(runId);
  }
}
