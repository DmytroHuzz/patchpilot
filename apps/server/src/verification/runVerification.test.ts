import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import {
  CompatibilityRepairResultSchema,
  DependencyUpdateResultSchema,
  TargetedTestResultSchema,
  type NormalizedScanResult,
  type RemediationPlanRun,
  type VerificationCommandResult,
} from "@patchpilot/contracts";
import { RemediationApprovalStore } from "../remediation/approvalGate.js";
import { createIsolatedGitWorkspace } from "../remediation/isolateRepository.js";
import {
  runBaselineAndPostPatchVerification,
  type VerificationCommandRunner,
  type VerificationScannerRunner,
} from "./runVerification.js";

const execFileAsync = promisify(execFile);
const temporaryRoots: string[] = [];
const runId = "run-00000000-0000-4000-8000-000000000012";
const planRun: RemediationPlanRun = {
  model: "gpt-5.6",
  source: "cached-demo",
  plan: {
    targetVersion: "1.0.2",
    strategy: "dependency_upgrade_and_code_change",
    explanation: "Upgrade json5 and preserve supported theme fields.",
    expectedFiles: ["package.json", "package-lock.json", "src/theme.js", "test/theme.test.js"],
    expectedCompatibilityRisks: ["Unknown theme keys will be dropped."],
    proposedCommands: [
      "npm install json5@1.0.2 --save-exact",
      "npm run test",
      "npm run build",
      "osv-scanner scan source .",
    ],
    proposedTests: ["Add a targeted test showing that unsupported input keys are not copied."],
    requiresHumanApproval: true,
  },
};
const originalSource = `const JSON5 = require("json5");

const DEFAULT_THEME = Object.freeze({ accent: "#75f2b3", density: "comfortable" });

function parseUserTheme(rawTheme) {
  const userTheme = JSON5.parse(rawTheme);
  return { ...DEFAULT_THEME, ...userTheme };
}

module.exports = { parseUserTheme };
`;
const repairedSource = `const JSON5 = require("json5");

const DEFAULT_THEME = Object.freeze({ accent: "#75f2b3", density: "comfortable" });

function parseUserTheme(rawTheme) {
  const userTheme = JSON5.parse(rawTheme);
  return {
    accent: typeof userTheme.accent === "string" ? userTheme.accent : DEFAULT_THEME.accent,
    density: typeof userTheme.density === "string" ? userTheme.density : DEFAULT_THEME.density,
  };
}

module.exports = { parseUserTheme };
`;
const originalTest = `const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { parseUserTheme } = require("../src/theme");

describe("theme preview", () => {
  it("supplies defaults", () => {
    assert.equal(parseUserTheme("{}").density, "comfortable");
  });
});
`;
const targetedTestText = `  it("does not copy unsupported theme fields", () => {
    const theme = parseUserTheme("{accent: '#ffb86c', density: 'compact', previewLabel: 'ignored'}");
    assert.deepEqual(theme, { accent: "#ffb86c", density: "compact" });
    assert.equal(Object.hasOwn(theme, "previewLabel"), false);
  });`;

async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", root, ...args], { encoding: "utf8" });
  return stdout.trim();
}

async function createFixture() {
  const boundaryRoot = await mkdtemp(path.join(tmpdir(), "patchpilot-verification-"));
  temporaryRoots.push(boundaryRoot);
  const sourceRoot = path.join(boundaryRoot, "source");
  const auditRoot = path.join(boundaryRoot, "runs/audit");
  const scannerPath = path.join(boundaryRoot, "fake-osv-scanner");
  await mkdir(path.join(sourceRoot, "src"), { recursive: true });
  await mkdir(path.join(sourceRoot, "test"), { recursive: true });
  await writeFile(scannerPath, "test scanner\n");
  await writeFile(path.join(sourceRoot, ".gitignore"), "node_modules/\n");
  await writeFile(path.join(sourceRoot, "package.json"), `${JSON.stringify({
    name: "verification-fixture",
    version: "1.0.0",
    scripts: { test: "node --test", build: "node --check src/theme.js" },
    dependencies: { json5: "1.0.1" },
  }, null, 2)}\n`);
  await writeFile(path.join(sourceRoot, "package-lock.json"), `${JSON.stringify({
    name: "verification-fixture",
    version: "1.0.0",
    lockfileVersion: 3,
    packages: {
      "": { name: "verification-fixture", version: "1.0.0", dependencies: { json5: "1.0.1" } },
      "node_modules/json5": { version: "1.0.1", integrity: "old", dependencies: { minimist: "^1.2.0" } },
      "node_modules/minimist": { version: "1.2.8", integrity: "same" },
    },
  }, null, 2)}\n`);
  await writeFile(path.join(sourceRoot, "src/theme.js"), originalSource);
  await writeFile(path.join(sourceRoot, "test/theme.test.js"), originalTest);
  await git(sourceRoot, ["init", "-b", "main"]);
  await git(sourceRoot, ["config", "user.email", "patchpilot@example.test"]);
  await git(sourceRoot, ["config", "user.name", "PatchPilot Test"]);
  await git(sourceRoot, ["add", "."]);
  await git(sourceRoot, ["commit", "-m", "verification baseline"]);

  const approvalStore = new RemediationApprovalStore();
  const pending = approvalStore.register(planRun);
  const proposal = approvalStore.decide({ planId: pending.id, decision: "approved" }, new Date("2026-07-18T11:00:00.000Z"));
  const isolationRun = await createIsolatedGitWorkspace({
    proposal,
    repositoryPath: sourceRoot,
    boundaryRoot,
    worktreeRoot: path.join(boundaryRoot, "runs/worktrees"),
    auditRoot,
    runId,
  });
  const repositoryPath = isolationRun.isolatedRepositoryPath;

  const manifest = JSON.parse(await readFile(path.join(repositoryPath, "package.json"), "utf8"));
  const lockfile = JSON.parse(await readFile(path.join(repositoryPath, "package-lock.json"), "utf8"));
  manifest.dependencies.json5 = "1.0.2";
  lockfile.packages[""].dependencies.json5 = "1.0.2";
  lockfile.packages["node_modules/json5"] = { version: "1.0.2", integrity: "new", dependencies: { minimist: "^1.2.0" } };
  await writeFile(path.join(repositoryPath, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(path.join(repositoryPath, "package-lock.json"), `${JSON.stringify(lockfile, null, 2)}\n`);
  const dependencyDiff = await git(repositoryPath, ["diff", "--no-ext-diff", "--unified=3", "--", "package-lock.json", "package.json"]);
  const dependencyUpdate = DependencyUpdateResultSchema.parse({
    runId,
    planId: proposal.id,
    status: "dependency_updated",
    packageName: "json5",
    fromVersion: "1.0.1",
    targetVersion: "1.0.2",
    manifestVersion: "1.0.2",
    lockfileVersion: "1.0.2",
    changedFiles: ["package-lock.json", "package.json"],
    unrelatedDependenciesChanged: false,
    sourceCheckoutClean: true,
    commandResult: { command: "npm install json5@1.0.2 --save-exact", exitCode: 0, durationMs: 1, stdout: "updated", stderr: "", outputTruncated: false },
    diff: dependencyDiff,
    resultLogPath: path.join(auditRoot, `${runId}-dependency-update.json`),
    completedAt: "2026-07-18T11:01:00.000Z",
  });

  await writeFile(path.join(repositoryPath, "src/theme.js"), repairedSource);
  const sourceDiff = await git(repositoryPath, ["diff", "--no-ext-diff", "--unified=3", "--", "src/theme.js"]);
  const compatibilityRepair = CompatibilityRepairResultSchema.parse({
    runId,
    planId: proposal.id,
    status: "repaired",
    file: "src/theme.js",
    attempts: [{
      attempt: 1,
      proposalRun: {
        model: "gpt-5.6",
        source: "cached-demo",
        proposal: {
          attempt: 1,
          action: "apply_replacement",
          classification: "planned_source_hardening",
          explanation: "Copy only supported fields.",
          file: "src/theme.js",
          oldText: originalSource.slice(originalSource.indexOf("function parseUserTheme"), originalSource.indexOf("\n\nmodule.exports")),
          newText: repairedSource.slice(repairedSource.indexOf("function parseUserTheme"), repairedSource.indexOf("\n\nmodule.exports")),
          compatibilityRisks: ["Unknown fields are dropped."],
          remainingUnknowns: ["Other callers remain outside the fixture."],
        },
      },
      status: "applied_passed",
      probe: { command: "node --check src/theme.js", exitCode: 0, passed: true, durationMs: 1, stdout: "", stderr: "" },
    }],
    changedFiles: ["package-lock.json", "package.json", "src/theme.js"],
    sourceCheckoutClean: true,
    sourceRestored: false,
    sourceDiff,
    resultLogPath: path.join(auditRoot, `${runId}-compatibility-repair.json`),
    completedAt: "2026-07-18T11:02:00.000Z",
  });

  const nextTest = originalTest.replace(/\n}\);\n$/, `\n${targetedTestText}\n});\n`);
  await writeFile(path.join(repositoryPath, "test/theme.test.js"), nextTest);
  const testDiff = await git(repositoryPath, ["diff", "--no-ext-diff", "--unified=3", "--", "test/theme.test.js"]);
  const targetedTest = TargetedTestResultSchema.parse({
    runId,
    planId: proposal.id,
    status: "test_added_passed",
    file: "test/theme.test.js",
    proposalRun: {
      model: "gpt-5.6",
      source: "cached-demo",
      proposal: {
        action: "add_test",
        classification: "mitigation_regression",
        explanation: "Check a benign unsupported field.",
        file: "test/theme.test.js",
        insertion: "before_final_suite_close",
        testName: "does not copy unsupported theme fields",
        testText: targetedTestText,
        safetyRationale: ["The input is benign."],
        remainingUnknowns: ["Other callers remain outside the fixture."],
      },
    },
    commandResult: { command: "node --test test/theme.test.js", exitCode: 0, passed: true, durationMs: 1, stdout: "passed", stderr: "", outputTruncated: false },
    changedFiles: ["package-lock.json", "package.json", "src/theme.js", "test/theme.test.js"],
    sourceCheckoutClean: true,
    testRestored: false,
    testDiff,
    resultLogPath: path.join(auditRoot, `${runId}-targeted-test.json`),
    completedAt: "2026-07-18T11:03:00.000Z",
  });

  return { boundaryRoot, sourceRoot, auditRoot, scannerPath, proposal, isolationRun, dependencyUpdate, compatibilityRepair, targetedTest };
}

function commandResult(options: Parameters<VerificationCommandRunner>[0], failed = false): VerificationCommandResult {
  return {
    phase: options.phase,
    kind: options.kind,
    command: options.command,
    status: failed ? "failed" : "passed",
    exitCode: failed ? 1 : 0,
    durationMs: 5,
    stdoutSummary: failed ? "" : "command passed",
    stderrSummary: failed ? "deterministic failure" : "",
    outputTruncated: false,
  };
}

function scan(repositoryPath: string, selectedPresent = false): NormalizedScanResult {
  return {
    scanner: "osv-scanner",
    scannerVersion: "2.3.8",
    repositoryPath,
    scannedAt: "2026-07-18T11:04:00.000Z",
    findings: selectedPresent ? [{
      id: "GHSA-9c47-m6qq-7p4h",
      aliases: ["CVE-2022-46175"],
      packageName: "json5",
      ecosystem: "npm",
      installedVersion: "1.0.1",
      manifestPath: "package.json",
      lockfilePath: "package-lock.json",
      direct: true,
      dependencyPath: ["json5"],
      severity: "HIGH",
      summary: "Prototype Pollution in JSON5 via Parse Method",
      details: "Fixture finding.",
      affectedRanges: [">=0 <1.0.2"],
      fixedVersions: ["1.0.2"],
      affectedFunctions: ["parse"],
      references: ["https://osv.dev/vulnerability/GHSA-9c47-m6qq-7p4h"],
      source: "osv",
    }] : [],
  };
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("baseline and post-patch verification", () => {
  it("retains all eight passing command facts and a clean selected-advisory rescan", async () => {
    const fixture = await createFixture();
    const executed: string[] = [];
    const commandRunner: VerificationCommandRunner = async (options) => {
      executed.push(`${options.phase}:${options.command}`);
      return commandResult(options);
    };
    const scannerRunner: VerificationScannerRunner = async ({ repositoryPath }) => ({
      commandResult: {
        phase: "rescan",
        kind: "rescan",
        command: "osv-scanner scan source --lockfile package-lock.json --format json --verbosity error",
        status: "passed",
        exitCode: 0,
        durationMs: 7,
        stdoutSummary: "Normalized 0 npm vulnerability finding(s); selected advisory absent.",
        stderrSummary: "",
        outputTruncated: false,
      },
      scan: scan(repositoryPath),
    });

    const result = await runBaselineAndPostPatchVerification({
      ...fixture,
      resultRoot: fixture.auditRoot,
      commandRunner,
      scannerRunner,
      now: new Date("2026-07-18T11:05:00.000Z"),
    });

    expect(result.status).toBe("verified");
    expect(result.commands).toHaveLength(8);
    expect(executed).toEqual([
      "baseline:npm ci --ignore-scripts",
      "baseline:npm test",
      "baseline:npm run build",
      "post_patch:npm ci --ignore-scripts",
      "post_patch:node --test test/theme.test.js",
      "post_patch:npm test",
      "post_patch:npm run build",
    ]);
    expect(result.rescan).toMatchObject({ findingCount: 0, selectedAdvisoryPresent: false });
    expect(result.failure).toBeNull();
    expect(JSON.parse(await readFile(result.resultLogPath, "utf8"))).toEqual(result);
    expect(await git(fixture.sourceRoot, ["status", "--porcelain=v1", "--untracked-files=all"])).toBe("");
  });

  it("stops after a baseline test failure and classifies it honestly", async () => {
    const fixture = await createFixture();
    let scannerCalls = 0;
    const result = await runBaselineAndPostPatchVerification({
      ...fixture,
      resultRoot: fixture.auditRoot,
      commandRunner: async (options) => commandResult(options, options.phase === "baseline" && options.kind === "full_test"),
      scannerRunner: async ({ repositoryPath }) => {
        scannerCalls += 1;
        return {
          commandResult: commandResult({ phase: "rescan", kind: "rescan", command: "osv-scanner scan source --lockfile package-lock.json --format json --verbosity error", executable: "node", args: [], cwd: repositoryPath }),
          scan: scan(repositoryPath),
        };
      },
    });

    expect(result.status).toBe("failed");
    expect(result.commands).toHaveLength(2);
    expect(result.failure?.classification).toBe("baseline_tests_failed");
    expect(result.baseline).toMatchObject({ installPassed: true, fullTestsPassed: false, buildPassed: null });
    expect(result.postPatch.installPassed).toBeNull();
    expect(scannerCalls).toBe(0);
  });

  it("fails closed when the selected advisory remains in a completed rescan", async () => {
    const fixture = await createFixture();
    const result = await runBaselineAndPostPatchVerification({
      ...fixture,
      resultRoot: fixture.auditRoot,
      commandRunner: async (options) => commandResult(options),
      scannerRunner: async ({ repositoryPath }) => ({
        commandResult: {
          phase: "rescan",
          kind: "rescan",
          command: "osv-scanner scan source --lockfile package-lock.json --format json --verbosity error",
          status: "findings_present",
          exitCode: 1,
          durationMs: 7,
          stdoutSummary: "Normalized 1 npm vulnerability finding(s); selected advisory present.",
          stderrSummary: "",
          outputTruncated: false,
        },
        scan: scan(repositoryPath, true),
      }),
    });

    expect(result.status).toBe("failed");
    expect(result.commands).toHaveLength(8);
    expect(result.failure?.classification).toBe("selected_advisory_still_detected");
    expect(result.rescan?.selectedAdvisoryPresent).toBe(true);
  });
});
