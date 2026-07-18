import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CompatibilityRepairResultSchema,
  DependencyUpdateResultSchema,
  InvestigationResultSchema,
  IsolationRunSchema,
  RemediationProposalSchema,
  TargetedTestResultSchema,
  VerificationResultSchema,
} from "@patchpilot/contracts";
import { generateEvidenceReport } from "./generateEvidenceReport.js";

const runId = "run-00000000-0000-4000-8000-000000000013";
const planId = `plan-${"d".repeat(64)}`;
const completedAt = "2026-07-18T12:00:00.000Z";
const temporaryRoots: string[] = [];

function finding() {
  return {
    id: "GHSA-9c47-m6qq-7p4h",
    aliases: ["CVE-2022-46175"],
    packageName: "json5",
    ecosystem: "npm" as const,
    installedVersion: "1.0.1",
    manifestPath: "package.json",
    lockfilePath: "package-lock.json",
    direct: true,
    dependencyPath: ["json5"],
    severity: "HIGH",
    summary: "Prototype Pollution in JSON5 via Parse Method",
    details: "The parse method is affected before version 1.0.2.",
    affectedRanges: [">=0 <1.0.2"],
    fixedVersions: ["1.0.2"],
    affectedFunctions: ["parse"],
    references: ["https://osv.dev/vulnerability/GHSA-9c47-m6qq-7p4h"],
    source: "osv" as const,
  };
}

function fixtures(repositoryPath: string) {
  const investigation = InvestigationResultSchema.parse({
    finding: finding(),
    advisory: {
      id: "GHSA-9c47-m6qq-7p4h",
      aliases: ["CVE-2022-46175"],
      summary: "Prototype Pollution in JSON5 via Parse Method",
      details: "The parse method is affected before version 1.0.2.",
      severity: "HIGH",
      affectedRanges: [">=0 <1.0.2"],
      fixedVersions: ["1.0.2"],
      affectedFunctions: ["parse"],
      references: ["https://osv.dev/vulnerability/GHSA-9c47-m6qq-7p4h"],
      source: "cached-demo",
    },
    evidence: {
      repositoryPath,
      findingId: "GHSA-9c47-m6qq-7p4h",
      searchedFiles: ["src/cli.js", "src/theme.js", "test/theme.test.js"],
      searchedBytes: 1024,
      truncated: false,
      items: [
        { id: "evidence-01", type: "import", file: "src/theme.js", startLine: 1, endLine: 1, excerpt: "const JSON5 = require(\"json5\");", explanation: "json5 is imported.", deterministic: true },
        { id: "evidence-02", type: "call-site", file: "src/theme.js", startLine: 8, endLine: 10, excerpt: "function parseUserTheme(rawTheme) {\n  const userTheme = JSON5.parse(rawTheme);\n", explanation: "User input reaches JSON5.parse.", deterministic: true },
        { id: "evidence-03", type: "absence", explanation: "No source reference to the advisory key was found.", deterministic: true },
      ],
    },
    assessmentRun: {
      model: "gpt-5.6",
      source: "cached-demo",
      assessment: {
        verdict: "likely_affected",
        confidence: "medium",
        rationale: "The direct dependency is imported and its parse method receives repository input.",
        supportingEvidenceIds: ["evidence-01", "evidence-02"],
        counterEvidenceIds: ["evidence-03"],
        unknowns: ["Whether every deployment exposes the input."],
        limitations: ["Static evidence does not prove runtime exploitability."],
        recommendedNextChecks: ["Review downstream consumers."],
      },
    },
  });
  const planRun = {
    model: "gpt-5.6" as const,
    source: "cached-demo" as const,
    plan: {
      targetVersion: "1.0.2",
      strategy: "dependency_upgrade_and_code_change" as const,
      explanation: "Upgrade json5 and copy only supported theme fields.",
      expectedFiles: ["package.json", "package-lock.json", "src/theme.js", "test/theme.test.js"],
      expectedCompatibilityRisks: ["Unknown fields will be dropped."],
      proposedCommands: ["npm install json5@1.0.2 --save-exact", "npm test", "npm run build"],
      proposedTests: ["Add one allowlist regression test."],
      requiresHumanApproval: true as const,
    },
  };
  const approval = { planId, decision: "approved" as const, recordedAt: "2026-07-18T11:30:00.000Z" };
  const proposal = RemediationProposalSchema.parse({ id: planId, planRun, status: "approved", approval });
  const events = ["approval_validated", "paths_validated", "clean_tree_validated", "baseline_captured", "worktree_created", "workspace_ready"].map((action, index) => ({
    sequence: index + 1,
    at: "2026-07-18T11:31:00.000Z",
    action,
    detail: action,
  }));
  const isolationRun = IsolationRunSchema.parse({
    id: runId,
    planId,
    status: "ready",
    sourceRepositoryPath: repositoryPath,
    sourceGitRoot: path.dirname(repositoryPath),
    sourceBranch: "main",
    baselineCommit: "a".repeat(40),
    branchName: `patchpilot/${runId}`,
    worktreePath: path.dirname(repositoryPath),
    isolatedRepositoryPath: repositoryPath,
    auditLogPath: "/bounded/audit.json",
    sourceTreeClean: true,
    createdAt: "2026-07-18T11:31:00.000Z",
    approval,
    events,
  });
  const dependencyUpdate = DependencyUpdateResultSchema.parse({
    runId, planId, status: "dependency_updated", packageName: "json5", fromVersion: "1.0.1", targetVersion: "1.0.2",
    manifestVersion: "1.0.2", lockfileVersion: "1.0.2", changedFiles: ["package-lock.json", "package.json"],
    unrelatedDependenciesChanged: false, sourceCheckoutClean: true,
    commandResult: { command: "npm install json5@1.0.2 --save-exact", exitCode: 0, durationMs: 4, stdout: "updated", stderr: "", outputTruncated: false },
    diff: "diff --git a/package.json b/package.json\n-    \"json5\": \"1.0.1\"\n+    \"json5\": \"1.0.2\"",
    resultLogPath: "/bounded/dependency.json", completedAt,
  });
  const repairProposal = {
    model: "gpt-5.6" as const,
    source: "cached-demo" as const,
    proposal: {
      attempt: 1 as const, action: "apply_replacement" as const, classification: "planned_source_hardening" as const,
      explanation: "Copy only supported fields.", file: "src/theme.js" as const, oldText: "return { ...userTheme };", newText: "return { accent: userTheme.accent };",
      compatibilityRisks: ["Unknown fields are dropped."], remainingUnknowns: ["Other callers may expect more fields."],
    },
  };
  const compatibilityRepair = CompatibilityRepairResultSchema.parse({
    runId, planId, status: "repaired", file: "src/theme.js",
    attempts: [{ attempt: 1, proposalRun: repairProposal, status: "applied_passed", probe: { command: "node --check src/theme.js", exitCode: 0, passed: true, durationMs: 1, stdout: "", stderr: "" } }],
    changedFiles: ["package-lock.json", "package.json", "src/theme.js"], sourceCheckoutClean: true, sourceRestored: false,
    sourceDiff: "diff --git a/src/theme.js b/src/theme.js\n-    ...userTheme,\n+    accent: userTheme.accent,",
    resultLogPath: "/bounded/repair.json", completedAt,
  });
  const testProposal = {
    model: "gpt-5.6" as const,
    source: "cached-demo" as const,
    proposal: {
      action: "add_test" as const, classification: "mitigation_regression" as const, explanation: "Verify unsupported fields are dropped.",
      file: "test/theme.test.js" as const, insertion: "before_final_suite_close" as const, testName: "does not copy unsupported theme fields",
      testText: "it(\"does not copy unsupported theme fields\", () => {});", safetyRationale: ["Uses benign input."],
      remainingUnknowns: ["Other callers are outside the fixture."],
    },
  };
  const targetedTest = TargetedTestResultSchema.parse({
    runId, planId, status: "test_added_passed", file: "test/theme.test.js", proposalRun: testProposal,
    commandResult: { command: "node --test test/theme.test.js", exitCode: 0, passed: true, durationMs: 2, stdout: "passed", stderr: "", outputTruncated: false },
    changedFiles: ["package-lock.json", "package.json", "src/theme.js", "test/theme.test.js"], sourceCheckoutClean: true, testRestored: false,
    testDiff: "diff --git a/test/theme.test.js b/test/theme.test.js\n+  it(\"does not copy unsupported theme fields\", () => {});",
    resultLogPath: "/bounded/test.json", completedAt,
  });
  const commands = [
    ["baseline", "install", "npm ci --ignore-scripts"], ["baseline", "full_test", "npm test"], ["baseline", "build", "npm run build"],
    ["post_patch", "install", "npm ci --ignore-scripts"], ["post_patch", "targeted_test", "node --test test/theme.test.js"],
    ["post_patch", "full_test", "npm test"], ["post_patch", "build", "npm run build"],
    ["rescan", "rescan", "osv-scanner scan source --lockfile package-lock.json --format json --verbosity error"],
  ].map(([phase, kind, command]) => ({ phase, kind, command, status: "passed", exitCode: 0, durationMs: 3, stdoutSummary: "passed", stderrSummary: "", outputTruncated: false }));
  const verification = VerificationResultSchema.parse({
    runId, planId, status: "verified", selectedAdvisoryId: "GHSA-9c47-m6qq-7p4h", commands,
    baseline: { installPassed: true, targetedTestPassed: null, fullTestsPassed: true, buildPassed: true },
    postPatch: { installPassed: true, targetedTestPassed: true, fullTestsPassed: true, buildPassed: true },
    rescan: { scanner: "osv-scanner", scannerVersion: "2.3.8", scannedAt: completedAt, findingCount: 0, selectedAdvisoryId: "GHSA-9c47-m6qq-7p4h", selectedAdvisoryPresent: false, findings: [] },
    failure: null, changedFiles: ["package-lock.json", "package.json", "src/theme.js", "test/theme.test.js"],
    sourceCheckoutClean: true, resultLogPath: "/bounded/verification.json", completedAt,
  });
  return { investigation, proposal, isolationRun, dependencyUpdate, compatibilityRepair, targetedTest, verification };
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("evidence report generation", () => {
  it("writes complete Markdown and JSON artifacts with explicit trust labels", async () => {
    const repositoryPath = path.resolve("../..", "demo/vulnerable-node-app");
    const resultRoot = await mkdtemp(path.join(tmpdir(), "patchpilot-report-"));
    temporaryRoots.push(resultRoot);
    const result = await generateEvidenceReport({
      ...fixtures(repositoryPath),
      sourceRepositoryPath: repositoryPath,
      resultRoot,
      now: new Date(completedAt),
    });

    expect(result.markdown).toContain("Original Finding — DETERMINISTIC FACT");
    expect(result.markdown).toContain("Affectedness Assessment — MODEL INTERPRETATION");
    expect(result.markdown).toContain("Human Approval — HUMAN DECISION");
    expect(result.markdown).toContain("Remaining Uncertainty — UNCERTAINTY");
    expect(result.markdown).toContain("test/theme.test.js");
    expect(result.markdown).not.toContain(repositoryPath);
    expect(JSON.parse(await readFile(path.join(resultRoot, `${runId}-report.json`), "utf8"))).toEqual(result.report);
    expect(await readFile(path.join(resultRoot, `${runId}-report.md`), "utf8")).toBe(result.markdown);
    expect(result.reportPaths).toEqual({ markdown: `runs/audit/${runId}-report.md`, json: `runs/audit/${runId}-report.json` });
  });

  it("fails closed when a cited line excerpt no longer matches the source", async () => {
    const repositoryPath = path.resolve("../..", "demo/vulnerable-node-app");
    const resultRoot = await mkdtemp(path.join(tmpdir(), "patchpilot-report-"));
    temporaryRoots.push(resultRoot);
    const evidence = fixtures(repositoryPath);
    evidence.investigation.evidence.items[0]!.excerpt = "tampered excerpt";

    await expect(generateEvidenceReport({
      ...evidence,
      sourceRepositoryPath: repositoryPath,
      resultRoot,
      now: new Date(completedAt),
    })).rejects.toThrow("no longer matches");
  });
});
