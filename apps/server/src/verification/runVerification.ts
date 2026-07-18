import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual, promisify } from "node:util";
import {
  CompatibilityRepairResultSchema,
  DependencyUpdateResultSchema,
  IsolationRunSchema,
  NormalizedScanResultSchema,
  TargetedTestResultSchema,
  VerificationCommandResultSchema,
  VerificationResultSchema,
  type CompatibilityRepairResult,
  type DependencyUpdateResult,
  type IsolationRun,
  type NormalizedScanResult,
  type RemediationProposal,
  type TargetedTestResult,
  type VerificationCommandResult,
  type VerificationFailure,
  type VerificationRescan,
  type VerificationResult,
} from "@patchpilot/contracts";
import { normalizeOsvOutput } from "../scanning/normalizeOsv.js";
import { scannerVersion } from "../scanning/osvScanner.js";
import { assertRemediationApproved } from "../remediation/approvalGate.js";
import { canonicalExistingPath, resolveInsideBoundary } from "../remediation/isolateRepository.js";

const execFileAsync = promisify(execFile);
const selectedAdvisoryId = "GHSA-9c47-m6qq-7p4h" as const;
const expectedChangedFiles = ["package-lock.json", "package.json", "src/theme.js", "test/theme.test.js"] as const;
const scannerCommand = "osv-scanner scan source --lockfile package-lock.json --format json --verbosity error" as const;

type CommandSpec = Pick<VerificationCommandResult, "phase" | "kind" | "command"> & {
  executable: "npm" | "node";
  args: string[];
};

export type VerificationCommandRunner = (options: CommandSpec & { cwd: string }) => Promise<VerificationCommandResult>;
export type VerificationScannerRunner = (options: {
  repositoryPath: string;
  scannerPath: string;
}) => Promise<{ commandResult: VerificationCommandResult; scan: NormalizedScanResult | null }>;

function redact(value: string): string {
  return value
    .replace(/\b(?:npm|gh[pousr])_[A-Za-z0-9_-]{20,}\b/g, "[REDACTED TOKEN]")
    .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, "[REDACTED TOKEN]")
    .replace(/(https?:\/\/[^\s/:@]+:)[^\s@]+@/g, "$1[REDACTED]@");
}

function bounded(value: string, limit = 32 * 1024): { value: string; truncated: boolean } {
  const redacted = redact(value);
  if (redacted.length <= limit) return { value: redacted, truncated: false };
  return { value: `${redacted.slice(0, limit - 28)}\n[output truncated by PatchPilot]`, truncated: true };
}

async function git(gitRoot: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", gitRoot, ...args], {
    encoding: "utf8",
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
  });
  return stdout.trim();
}

async function defaultCommandRunner(options: CommandSpec & { cwd: string }): Promise<VerificationCommandResult> {
  const startedAt = Date.now();
  try {
    const { stdout, stderr } = await execFileAsync(options.executable, options.args, {
      cwd: options.cwd,
      encoding: "utf8",
      timeout: 60_000,
      maxBuffer: 512 * 1024,
      env: { ...process.env, CI: "1", NO_UPDATE_NOTIFIER: "1" },
    });
    const boundedStdout = bounded(stdout);
    const boundedStderr = bounded(stderr);
    return VerificationCommandResultSchema.parse({
      phase: options.phase,
      kind: options.kind,
      command: options.command,
      status: "passed",
      exitCode: 0,
      durationMs: Date.now() - startedAt,
      stdoutSummary: boundedStdout.value,
      stderrSummary: boundedStderr.value,
      outputTruncated: boundedStdout.truncated || boundedStderr.truncated,
    });
  } catch (error) {
    const failure = error as Error & { code?: number | string; stdout?: string; stderr?: string };
    const boundedStdout = bounded(failure.stdout ?? "");
    const boundedStderr = bounded(failure.stderr ?? failure.message);
    return VerificationCommandResultSchema.parse({
      phase: options.phase,
      kind: options.kind,
      command: options.command,
      status: "failed",
      exitCode: typeof failure.code === "number" ? failure.code : 124,
      durationMs: Date.now() - startedAt,
      stdoutSummary: boundedStdout.value,
      stderrSummary: boundedStderr.value,
      outputTruncated: boundedStdout.truncated || boundedStderr.truncated,
    });
  }
}

async function defaultScannerRunner(options: {
  repositoryPath: string;
  scannerPath: string;
}): Promise<{ commandResult: VerificationCommandResult; scan: NormalizedScanResult | null }> {
  const startedAt = Date.now();
  let stdout = "";
  let stderr = "";
  let exitCode = 0;
  try {
    ({ stdout, stderr } = await execFileAsync(options.scannerPath, [
      "scan",
      "source",
      "--lockfile",
      "package-lock.json",
      "--format",
      "json",
      "--verbosity",
      "error",
    ], {
      cwd: options.repositoryPath,
      encoding: "utf8",
      timeout: 30_000,
      maxBuffer: 5 * 1024 * 1024,
    }));
  } catch (error) {
    const failure = error as Error & { code?: number | string; stdout?: string; stderr?: string };
    exitCode = typeof failure.code === "number" ? failure.code : 124;
    stdout = failure.stdout ?? "";
    stderr = failure.stderr ?? failure.message;
    if (exitCode !== 1 || !stdout) {
      const boundedStderr = bounded(stderr);
      return {
        commandResult: VerificationCommandResultSchema.parse({
          phase: "rescan",
          kind: "rescan",
          command: scannerCommand,
          status: "failed",
          exitCode,
          durationMs: Date.now() - startedAt,
          stdoutSummary: "OSV-Scanner did not return a usable normalized result.",
          stderrSummary: boundedStderr.value,
          outputTruncated: boundedStderr.truncated,
        }),
        scan: null,
      };
    }
  }

  try {
    const normalized = NormalizedScanResultSchema.parse({
      scanner: "osv-scanner",
      scannerVersion: await scannerVersion(options.scannerPath),
      repositoryPath: options.repositoryPath,
      scannedAt: new Date().toISOString(),
      findings: normalizeOsvOutput(JSON.parse(stdout), options.repositoryPath),
    });
    const boundedStderr = bounded(stderr);
    return {
      commandResult: VerificationCommandResultSchema.parse({
        phase: "rescan",
        kind: "rescan",
        command: scannerCommand,
        status: exitCode === 1 ? "findings_present" : "passed",
        exitCode,
        durationMs: Date.now() - startedAt,
        stdoutSummary: `Normalized ${normalized.findings.length} npm vulnerability finding(s); selected advisory ${normalized.findings.some((finding) => finding.id === selectedAdvisoryId) ? "present" : "absent"}.`,
        stderrSummary: boundedStderr.value,
        outputTruncated: boundedStderr.truncated,
      }),
      scan: normalized,
    };
  } catch (error) {
    const boundedStderr = bounded(error instanceof Error ? error.message : "OSV-Scanner returned an invalid result");
    return {
      commandResult: VerificationCommandResultSchema.parse({
        phase: "rescan",
        kind: "rescan",
        command: scannerCommand,
        status: "failed",
        exitCode,
        durationMs: Date.now() - startedAt,
        stdoutSummary: "OSV-Scanner output could not be normalized.",
        stderrSummary: boundedStderr.value,
        outputTruncated: boundedStderr.truncated,
      }),
      scan: null,
    };
  }
}

export class VerificationStore {
  readonly #resultsByRun = new Map<string, VerificationResult>();

  register(result: VerificationResult): VerificationResult {
    const validated = VerificationResultSchema.parse(result);
    const existing = this.#resultsByRun.get(validated.runId);
    if (existing) return existing;
    this.#resultsByRun.set(validated.runId, validated);
    return validated;
  }

  getByRun(runId: string): VerificationResult | undefined {
    return this.#resultsByRun.get(runId);
  }
}

export async function runBaselineAndPostPatchVerification(options: {
  proposal: RemediationProposal;
  isolationRun: IsolationRun;
  dependencyUpdate: DependencyUpdateResult;
  compatibilityRepair: CompatibilityRepairResult;
  targetedTest: TargetedTestResult;
  boundaryRoot: string;
  resultRoot: string;
  scannerPath?: string;
  now?: Date;
  commandRunner?: VerificationCommandRunner;
  scannerRunner?: VerificationScannerRunner;
}): Promise<VerificationResult> {
  assertRemediationApproved(options.proposal);
  const isolationRun = IsolationRunSchema.parse(options.isolationRun);
  const dependencyUpdate = DependencyUpdateResultSchema.parse(options.dependencyUpdate);
  const compatibilityRepair = CompatibilityRepairResultSchema.parse(options.compatibilityRepair);
  const targetedTest = TargetedTestResultSchema.parse(options.targetedTest);
  if (
    isolationRun.planId !== options.proposal.id
    || dependencyUpdate.planId !== options.proposal.id
    || compatibilityRepair.planId !== options.proposal.id
    || targetedTest.planId !== options.proposal.id
    || dependencyUpdate.runId !== isolationRun.id
    || compatibilityRepair.runId !== isolationRun.id
    || targetedTest.runId !== isolationRun.id
  ) throw new Error("Verification inputs do not belong to the same approved isolated run");
  if (compatibilityRepair.status !== "repaired" || targetedTest.status !== "test_added_passed") {
    throw new Error("Verification requires retained passing repair and targeted-test checkpoints");
  }
  for (const approvedCommand of ["npm run test", "npm run build", "osv-scanner scan source ."]) {
    if (!options.proposal.planRun.plan.proposedCommands.includes(approvedCommand)) {
      throw new Error(`Approved remediation plan does not include verification command: ${approvedCommand}`);
    }
  }

  const boundaryRoot = path.resolve(options.boundaryRoot);
  const sourceGitRoot = await canonicalExistingPath(boundaryRoot, isolationRun.sourceGitRoot, "Source Git root");
  const worktreePath = await canonicalExistingPath(boundaryRoot, isolationRun.worktreePath, "Isolated worktree");
  const repositoryPath = await canonicalExistingPath(worktreePath, isolationRun.isolatedRepositoryPath, "Isolated repository");
  const resultRoot = await canonicalExistingPath(boundaryRoot, options.resultRoot, "Verification result root");
  const resultLogPath = resolveInsideBoundary(resultRoot, path.join(resultRoot, `${isolationRun.id}-verification.json`), "Verification result log");
  const scannerPath = await canonicalExistingPath(boundaryRoot, options.scannerPath ?? path.join(boundaryRoot, "tools/bin/osv-scanner"), "OSV-Scanner path");

  const currentChangedFiles = async () => (await git(worktreePath, ["diff", "--name-only", "--"])).split("\n").filter(Boolean).sort();
  const assertCheckpoint = async () => {
    if (!isDeepStrictEqual(await currentChangedFiles(), [...expectedChangedFiles])) throw new Error("Verification requires the exact approved four-file checkpoint");
    const dependencyDiff = await git(worktreePath, ["diff", "--no-ext-diff", "--unified=3", "--", "package-lock.json", "package.json"]);
    const sourceDiff = await git(worktreePath, ["diff", "--no-ext-diff", "--unified=3", "--", "src/theme.js"]);
    const testDiff = await git(worktreePath, ["diff", "--no-ext-diff", "--unified=3", "--", "test/theme.test.js"]);
    if (dependencyDiff !== dependencyUpdate.diff || sourceDiff !== compatibilityRepair.sourceDiff || testDiff !== targetedTest.testDiff) {
      throw new Error("Verification checkpoint no longer matches the recorded approved patch");
    }
  };

  if (await git(worktreePath, ["branch", "--show-current"]) !== isolationRun.branchName) throw new Error("Verification worktree branch does not match the isolated run");
  if (await git(worktreePath, ["rev-parse", "HEAD"]) !== isolationRun.baselineCommit) throw new Error("Verification worktree baseline does not match the isolated run");
  if (await git(sourceGitRoot, ["rev-parse", "HEAD"]) !== isolationRun.baselineCommit) throw new Error("Source checkout no longer matches the recorded vulnerable baseline");
  if (await git(sourceGitRoot, ["status", "--porcelain=v1", "--untracked-files=all"])) throw new Error("Source checkout must be clean before baseline verification");
  await assertCheckpoint();

  const commands: VerificationCommandResult[] = [];
  const baseline = { installPassed: null as boolean | null, targetedTestPassed: null, fullTestsPassed: null as boolean | null, buildPassed: null as boolean | null };
  const postPatch = { installPassed: null as boolean | null, targetedTestPassed: null as boolean | null, fullTestsPassed: null as boolean | null, buildPassed: null as boolean | null };
  const commandRunner = options.commandRunner ?? defaultCommandRunner;
  const scannerRunner = options.scannerRunner ?? defaultScannerRunner;

  const finish = async (failure: VerificationFailure | null, rescan: VerificationRescan | null): Promise<VerificationResult> => {
    await assertCheckpoint();
    if (await git(sourceGitRoot, ["status", "--porcelain=v1", "--untracked-files=all"])) throw new Error("Source checkout changed during verification");
    const result = VerificationResultSchema.parse({
      runId: isolationRun.id,
      planId: isolationRun.planId,
      status: failure ? "failed" : "verified",
      selectedAdvisoryId,
      commands,
      baseline,
      postPatch,
      rescan,
      failure,
      changedFiles: await currentChangedFiles(),
      sourceCheckoutClean: true,
      resultLogPath,
      completedAt: (options.now ?? new Date()).toISOString(),
    });
    await writeFile(resultLogPath, `${JSON.stringify(result, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    return result;
  };

  const execute = async (cwd: string, spec: CommandSpec) => {
    const result = VerificationCommandResultSchema.parse(await commandRunner({ ...spec, cwd }));
    if (result.phase !== spec.phase || result.kind !== spec.kind || result.command !== spec.command) {
      throw new Error("Verification runner returned a result for an unexpected command");
    }
    commands.push(result);
    return result;
  };

  const failCommand = (result: VerificationCommandResult, classification: VerificationFailure["classification"]): VerificationFailure => ({
    classification,
    phase: result.phase,
    command: result.command,
    summary: `${result.command} failed with exit code ${result.exitCode}.`,
  });

  const sequence: Array<{
    cwd: string;
    spec: CommandSpec;
    setPassed: (passed: boolean) => void;
    failure: VerificationFailure["classification"];
  }> = [
    { cwd: sourceGitRoot, spec: { phase: "baseline", kind: "install", command: "npm ci --ignore-scripts", executable: "npm", args: ["ci", "--ignore-scripts"] }, setPassed: (passed) => { baseline.installPassed = passed; }, failure: "baseline_install_failed" },
    { cwd: sourceGitRoot, spec: { phase: "baseline", kind: "full_test", command: "npm test", executable: "npm", args: ["test"] }, setPassed: (passed) => { baseline.fullTestsPassed = passed; }, failure: "baseline_tests_failed" },
    { cwd: sourceGitRoot, spec: { phase: "baseline", kind: "build", command: "npm run build", executable: "npm", args: ["run", "build"] }, setPassed: (passed) => { baseline.buildPassed = passed; }, failure: "baseline_build_failed" },
    { cwd: repositoryPath, spec: { phase: "post_patch", kind: "install", command: "npm ci --ignore-scripts", executable: "npm", args: ["ci", "--ignore-scripts"] }, setPassed: (passed) => { postPatch.installPassed = passed; }, failure: "post_patch_install_failed" },
    { cwd: repositoryPath, spec: { phase: "post_patch", kind: "targeted_test", command: "node --test test/theme.test.js", executable: "node", args: ["--test", "test/theme.test.js"] }, setPassed: (passed) => { postPatch.targetedTestPassed = passed; }, failure: "targeted_test_failed" },
    { cwd: repositoryPath, spec: { phase: "post_patch", kind: "full_test", command: "npm test", executable: "npm", args: ["test"] }, setPassed: (passed) => { postPatch.fullTestsPassed = passed; }, failure: "full_tests_failed" },
    { cwd: repositoryPath, spec: { phase: "post_patch", kind: "build", command: "npm run build", executable: "npm", args: ["run", "build"] }, setPassed: (passed) => { postPatch.buildPassed = passed; }, failure: "post_patch_build_failed" },
  ];

  for (const item of sequence) {
    const result = await execute(item.cwd, item.spec);
    const passed = result.status === "passed";
    item.setPassed(passed);
    if (!passed) return finish(failCommand(result, item.failure), null);
  }

  await assertCheckpoint();
  const scannerExecution = await scannerRunner({ repositoryPath, scannerPath });
  const scannerResult = VerificationCommandResultSchema.parse(scannerExecution.commandResult);
  if (scannerResult.phase !== "rescan" || scannerResult.kind !== "rescan" || scannerResult.command !== scannerCommand) {
    throw new Error("Verification scanner returned an unexpected command result");
  }
  commands.push(scannerResult);
  if (!scannerExecution.scan || scannerResult.status === "failed") {
    return finish({
      classification: "rescan_execution_failed",
      phase: "rescan",
      command: scannerCommand,
      summary: `OSV rescan could not be normalized (exit ${scannerResult.exitCode}).`,
    }, null);
  }

  const scan = NormalizedScanResultSchema.parse(scannerExecution.scan);
  const rescan: VerificationRescan = {
    scanner: scan.scanner,
    scannerVersion: scan.scannerVersion,
    scannedAt: scan.scannedAt,
    findingCount: scan.findings.length,
    selectedAdvisoryId,
    selectedAdvisoryPresent: scan.findings.some((finding) => finding.id === selectedAdvisoryId),
    findings: scan.findings,
  };
  if (rescan.selectedAdvisoryPresent) {
    return finish({
      classification: "selected_advisory_still_detected",
      phase: "rescan",
      command: scannerCommand,
      summary: `${selectedAdvisoryId} remains in the normalized OSV rescan.`,
    }, rescan);
  }
  return finish(null, rescan);
}
