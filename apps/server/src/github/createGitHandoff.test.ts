import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { EvidenceReportResultSchema, IsolationRunSchema, type EvidenceReportResult } from "@patchpilot/contracts";
import { createGitHandoff } from "./createGitHandoff.js";

const execFileAsync = promisify(execFile);
const temporaryRoots: string[] = [];
const runId = "run-00000000-0000-4000-8000-000000000014";
const planId = `plan-${"e".repeat(64)}`;
const at = "2026-07-18T14:00:00.000Z";
const files = ["package-lock.json", "package.json", "src/theme.js", "test/theme.test.js"] as const;

async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", root, ...args], { encoding: "utf8" });
  return stdout.trim();
}

function verifiedReport(): EvidenceReportResult {
  const approval = { planId, decision: "approved" as const, recordedAt: at };
  const finding = {
    id: "GHSA-9c47-m6qq-7p4h", aliases: ["CVE-2022-46175"], packageName: "json5", ecosystem: "npm" as const,
    installedVersion: "1.0.1", manifestPath: "package.json", lockfilePath: "package-lock.json", direct: true,
    dependencyPath: ["json5"], severity: "HIGH", summary: "Prototype Pollution in JSON5 via Parse Method",
    details: "The parse method is affected before version 1.0.2.", affectedRanges: [">=0 <1.0.2"], fixedVersions: ["1.0.2"],
    affectedFunctions: ["parse"], references: ["https://osv.dev/vulnerability/GHSA-9c47-m6qq-7p4h"], source: "osv" as const,
  };
  const assessmentRun = {
    model: "gpt-5.6" as const, source: "cached-demo" as const,
    assessment: {
      verdict: "likely_affected" as const, confidence: "medium" as const,
      rationale: "A direct parse call receives repository input.", supportingEvidenceIds: ["evidence-01"], counterEvidenceIds: [],
      unknowns: ["Deployment exposure was not measured."], limitations: ["Static evidence does not prove exploitability."],
      recommendedNextChecks: ["Review downstream consumers."],
    },
  };
  const remediationPlan = {
    model: "gpt-5.6" as const, source: "cached-demo" as const,
    plan: {
      targetVersion: "1.0.2", strategy: "dependency_upgrade_and_code_change" as const,
      explanation: "Upgrade json5 and copy only supported fields.", expectedFiles: [...files],
      expectedCompatibilityRisks: ["Unknown fields are dropped."], proposedCommands: ["npm test", "npm run build"],
      proposedTests: ["Add one allowlist regression test."], requiresHumanApproval: true as const,
    },
  };
  const compatibilityRepair = {
    model: "gpt-5.6" as const, source: "cached-demo" as const,
    proposal: {
      attempt: 1 as const, action: "apply_replacement" as const, classification: "planned_source_hardening" as const,
      explanation: "Copy supported fields only.", file: "src/theme.js" as const, oldText: "return userTheme;", newText: "return { accent: userTheme.accent };",
      compatibilityRisks: ["Unknown fields are dropped."], remainingUnknowns: ["Other callers may expect more fields."],
    },
  };
  const targetedTest = {
    model: "gpt-5.6" as const, source: "cached-demo" as const,
    proposal: {
      action: "add_test" as const, classification: "mitigation_regression" as const,
      explanation: "Confirm unsupported keys are dropped.", file: "test/theme.test.js" as const,
      insertion: "before_final_suite_close" as const, testName: "does not copy unsupported theme fields",
      testText: "it(\"does not copy unsupported theme fields\", () => {});", safetyRationale: ["Uses benign input."],
      remainingUnknowns: ["Other callers remain outside this fixture."],
    },
  };
  const commands = [
    ["baseline", "install", "npm ci --ignore-scripts"], ["baseline", "full_test", "npm test"], ["baseline", "build", "npm run build"],
    ["post_patch", "install", "npm ci --ignore-scripts"], ["post_patch", "targeted_test", "node --test test/theme.test.js"],
    ["post_patch", "full_test", "npm test"], ["post_patch", "build", "npm run build"],
    ["rescan", "rescan", "osv-scanner scan source --lockfile package-lock.json --format json --verbosity error"],
  ].map(([phase, kind, command]) => ({ phase, kind, command, status: "passed", exitCode: 0, durationMs: 3, stdoutSummary: "passed", stderrSummary: "", outputTruncated: false }));
  const report = {
    schemaVersion: "1.0", reportId: `report-${runId}`, runId, planId, generatedAt: at,
    deterministicFacts: {
      finding, evidence: [{ id: "evidence-01", type: "call-site", file: "src/theme.js", startLine: 1, endLine: 1, excerpt: "baseline", explanation: "json5 parse call.", deterministic: true }],
      patch: {
        changedFiles: files,
        dependency: { packageName: "json5", fromVersion: "1.0.1", toVersion: "1.0.2", files: ["package-lock.json", "package.json"], diff: "dependency diff" },
        source: { file: "src/theme.js", diff: "source diff" },
        test: { file: "test/theme.test.js", name: "does not copy unsupported theme fields", diff: "test diff" },
      },
      commands,
      rescan: { scanner: "osv-scanner", scannerVersion: "2.3.8", scannedAt: at, findingCount: 0, selectedAdvisoryId: finding.id, selectedAdvisoryPresent: false, findings: [] },
      sourceCheckoutClean: true,
    },
    modelInterpretation: { affectedness: assessmentRun, remediationPlan, compatibilityRepair, targetedTest },
    humanDecision: approval,
    uncertainty: {
      affectednessUnknowns: assessmentRun.assessment.unknowns, limitations: assessmentRun.assessment.limitations,
      compatibilityUnknowns: compatibilityRepair.proposal.remainingUnknowns, testUnknowns: targetedTest.proposal.remainingUnknowns,
      recommendedNextChecks: assessmentRun.assessment.recommendedNextChecks,
      disclaimer: "Verified checks reduce uncertainty but do not certify exploitability, compliance, or security." as const,
    },
    finalStatus: { status: "verified" as const, selectedAdvisoryPresent: false, summary: "Verified patch and clean selected-advisory rescan." },
  };
  return EvidenceReportResultSchema.parse({
    runId, planId, status: "reported", report, markdown: "# verified report", completedAt: at,
    reportPaths: { markdown: `runs/audit/${runId}-report.md`, json: `runs/audit/${runId}-report.json` },
  });
}

async function fixture() {
  const boundaryRoot = await mkdtemp(path.join(tmpdir(), "patchpilot-handoff-"));
  temporaryRoots.push(boundaryRoot);
  const sourceRoot = path.join(boundaryRoot, "source");
  const worktreePath = path.join(boundaryRoot, "runs", "worktrees", runId);
  await mkdir(path.join(sourceRoot, "src"), { recursive: true });
  await mkdir(path.join(sourceRoot, "test"), { recursive: true });
  await git(sourceRoot, ["init", "-b", "main"]);
  for (const file of files) {
    await writeFile(path.join(sourceRoot, file), `baseline ${file}\n`);
  }
  await git(sourceRoot, ["add", "."]);
  await git(sourceRoot, ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "baseline"]);
  const baselineCommit = await git(sourceRoot, ["rev-parse", "HEAD"]);
  await mkdir(path.dirname(worktreePath), { recursive: true });
  await git(sourceRoot, ["worktree", "add", "-b", `patchpilot/${runId}`, worktreePath, baselineCommit]);
  for (const file of files) {
    await writeFile(path.join(worktreePath, file), `patched ${file}\n`);
  }
  const events = ["approval_validated", "paths_validated", "clean_tree_validated", "baseline_captured", "worktree_created", "workspace_ready"].map((action, index) => ({
    sequence: index + 1, at, action, detail: action,
  }));
  const isolationRun = IsolationRunSchema.parse({
    id: runId, planId, status: "ready", sourceRepositoryPath: sourceRoot, sourceGitRoot: sourceRoot, sourceBranch: "main",
    baselineCommit, branchName: `patchpilot/${runId}`, worktreePath, isolatedRepositoryPath: worktreePath,
    auditLogPath: path.join(boundaryRoot, "runs", "audit", `${runId}.json`), sourceTreeClean: true, createdAt: at,
    approval: { planId, decision: "approved", recordedAt: at }, events,
  });
  return { boundaryRoot, sourceRoot, worktreePath, baselineCommit, isolationRun };
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("local Git handoff", () => {
  it("commits exactly the verified patch and creates accurate PR-ready copy without publishing", async () => {
    const setup = await fixture();
    const result = await createGitHandoff({
      evidenceReport: verifiedReport(), isolationRun: setup.isolationRun, boundaryRoot: setup.boundaryRoot,
      resultRoot: path.join(setup.boundaryRoot, "runs", "audit"), now: new Date(at),
    });

    expect(result.commit.parent).toBe(setup.baselineCommit);
    expect(result.commit.message).toBe("fix: remediate GHSA-9c47-m6qq-7p4h in json5");
    expect(result.commit.changedFiles).toEqual(files);
    expect(await git(setup.worktreePath, ["status", "--porcelain=v1", "--untracked-files=all"])).toBe("");
    expect(await git(setup.sourceRoot, ["status", "--porcelain=v1", "--untracked-files=all"])).toBe("");
    expect(await git(setup.worktreePath, ["show", "--format=", "--name-only", "HEAD"])).toContain("test/theme.test.js");
    expect(result.pullRequestDraft.body).toContain("## Verification commands");
    expect(result.pullRequestDraft.body).toContain("## Remaining uncertainty and limitations");
    expect(result.pullRequestDraft.body).toContain("PatchPilot was built and iterated with Codex");
    expect(result.pullRequestDraft.body).toContain("source `cached-demo`");
    expect(result.pullRequestDraft.body).toContain("Remote publication was not requested");
    expect(result.pullRequestDraft.body).not.toContain(setup.boundaryRoot);
    expect(result.remotePublication).toMatchObject({ status: "not_requested", requiresExplicitApproval: true });
    expect(JSON.parse(await readFile(path.join(setup.boundaryRoot, result.resultLogPath), "utf8"))).toEqual(result);
    expect(await git(setup.sourceRoot, ["remote"])).toBe("");
  });

  it("fails before committing when an unexpected fifth file is present", async () => {
    const setup = await fixture();
    await writeFile(path.join(setup.worktreePath, "unexpected.txt"), "not approved\n");

    await expect(createGitHandoff({
      evidenceReport: verifiedReport(), isolationRun: setup.isolationRun, boundaryRoot: setup.boundaryRoot,
      resultRoot: path.join(setup.boundaryRoot, "runs", "audit"),
    })).rejects.toThrow("exactly the approved four files");
    expect(await git(setup.worktreePath, ["rev-parse", "HEAD"])).toBe(setup.baselineCommit);
  });
});
