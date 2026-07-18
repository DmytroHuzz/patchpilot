import { execFile } from "node:child_process";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual, promisify } from "node:util";
import {
  CompatibilityRepairResultSchema,
  DependencyUpdateResultSchema,
  IsolationRunSchema,
  TargetedTestCommandResultSchema,
  TargetedTestProposalRunSchema,
  TargetedTestResultSchema,
  type CompatibilityRepairResult,
  type DependencyUpdateResult,
  type IsolationRun,
  type RemediationProposal,
  type TargetedTestCommandResult,
  type TargetedTestProposalRun,
  type TargetedTestResult,
} from "@patchpilot/contracts";
import { createTargetedTestContext, type TargetedTestContext } from "../ai/targetedTestContext.js";
import { resolveTargetedTest } from "../ai/generateTargetedTest.js";
import { validateTargetedTest } from "../ai/validateTargetedTest.js";
import { assertRemediationApproved } from "./approvalGate.js";
import { canonicalExistingPath, resolveInsideBoundary } from "./isolateRepository.js";

const execFileAsync = promisify(execFile);
const testFile = "test/theme.test.js" as const;
const sourceFile = "src/theme.js" as const;
const targetedCommand = "node --test test/theme.test.js" as const;

export type TargetedTestResolver = (context: TargetedTestContext) => Promise<TargetedTestProposalRun>;
export type TargetedTestRunner = (repositoryPath: string) => Promise<TargetedTestCommandResult>;

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

async function readBoundedFile(filePath: string): Promise<string> {
  const fileStat = await stat(filePath);
  if (!fileStat.isFile() || fileStat.size > 32 * 1024) throw new Error("Targeted test input exceeds the 32 KiB boundary");
  return readFile(filePath, "utf8");
}

export function insertBeforeFinalSuiteClose(existing: string, testText: string): string {
  const finalNewlines = existing.match(/\n*$/)?.[0] ?? "";
  const withoutFinalNewline = finalNewlines ? existing.slice(0, -finalNewlines.length) : existing;
  const suiteClose = "});";
  if (!withoutFinalNewline.endsWith(suiteClose)) throw new Error("Existing test file has no final describe-suite close");
  return `${withoutFinalNewline.slice(0, -suiteClose.length)}\n${testText}\n${suiteClose}${finalNewlines}`;
}

async function defaultTargetedTestRunner(repositoryPath: string): Promise<TargetedTestCommandResult> {
  const startedAt = Date.now();
  try {
    const { stdout, stderr } = await execFileAsync("node", ["--test", testFile], {
      cwd: repositoryPath,
      encoding: "utf8",
      timeout: 30_000,
      maxBuffer: 256 * 1024,
    });
    const boundedStdout = bounded(stdout);
    const boundedStderr = bounded(stderr);
    return TargetedTestCommandResultSchema.parse({
      command: targetedCommand,
      exitCode: 0,
      passed: true,
      durationMs: Date.now() - startedAt,
      stdout: boundedStdout.value,
      stderr: boundedStderr.value,
      outputTruncated: boundedStdout.truncated || boundedStderr.truncated,
    });
  } catch (error) {
    const failure = error as Error & { code?: number | string; stdout?: string; stderr?: string };
    const boundedStdout = bounded(failure.stdout ?? "");
    const boundedStderr = bounded(failure.stderr ?? failure.message);
    return TargetedTestCommandResultSchema.parse({
      command: targetedCommand,
      exitCode: typeof failure.code === "number" ? failure.code : 1,
      passed: false,
      durationMs: Date.now() - startedAt,
      stdout: boundedStdout.value,
      stderr: boundedStderr.value,
      outputTruncated: boundedStdout.truncated || boundedStderr.truncated,
    });
  }
}

export class TargetedTestStore {
  readonly #resultsByRun = new Map<string, TargetedTestResult>();

  register(result: TargetedTestResult): TargetedTestResult {
    const validated = TargetedTestResultSchema.parse(result);
    const existing = this.#resultsByRun.get(validated.runId);
    if (existing) return existing;
    this.#resultsByRun.set(validated.runId, validated);
    return validated;
  }

  getByRun(runId: string): TargetedTestResult | undefined {
    return this.#resultsByRun.get(runId);
  }
}

export async function generateTargetedRegressionTest(options: {
  proposal: RemediationProposal;
  isolationRun: IsolationRun;
  dependencyUpdate: DependencyUpdateResult;
  compatibilityRepair: CompatibilityRepairResult;
  boundaryRoot: string;
  resultRoot: string;
  fixturePath: string;
  now?: Date;
  resolver?: TargetedTestResolver;
  testRunner?: TargetedTestRunner;
}): Promise<TargetedTestResult> {
  assertRemediationApproved(options.proposal);
  const isolationRun = IsolationRunSchema.parse(options.isolationRun);
  const dependencyUpdate = DependencyUpdateResultSchema.parse(options.dependencyUpdate);
  const compatibilityRepair = CompatibilityRepairResultSchema.parse(options.compatibilityRepair);
  if (
    isolationRun.planId !== options.proposal.id
    || dependencyUpdate.planId !== options.proposal.id
    || compatibilityRepair.planId !== options.proposal.id
    || dependencyUpdate.runId !== isolationRun.id
    || compatibilityRepair.runId !== isolationRun.id
  ) {
    throw new Error("Targeted test inputs do not belong to the same approved isolated run");
  }
  if (compatibilityRepair.status !== "repaired") throw new Error("Targeted test generation requires a retained passing source repair");

  const boundaryRoot = path.resolve(options.boundaryRoot);
  const sourceGitRoot = await canonicalExistingPath(boundaryRoot, isolationRun.sourceGitRoot, "Source Git root");
  const worktreePath = await canonicalExistingPath(boundaryRoot, isolationRun.worktreePath, "Isolated worktree");
  const repositoryPath = await canonicalExistingPath(worktreePath, isolationRun.isolatedRepositoryPath, "Isolated repository");
  const resultRoot = await canonicalExistingPath(boundaryRoot, options.resultRoot, "Targeted test result root");
  const resultLogPath = resolveInsideBoundary(resultRoot, path.join(resultRoot, `${isolationRun.id}-targeted-test.json`), "Targeted test result log");
  const testPath = resolveInsideBoundary(repositoryPath, path.join(repositoryPath, testFile), "Targeted test path");
  const sourcePath = resolveInsideBoundary(repositoryPath, path.join(repositoryPath, sourceFile), "Repaired source path");

  if (await git(worktreePath, ["branch", "--show-current"]) !== isolationRun.branchName) throw new Error("Targeted test worktree branch does not match the isolated run");
  if (await git(worktreePath, ["rev-parse", "HEAD"]) !== isolationRun.baselineCommit) throw new Error("Targeted test worktree baseline does not match the isolated run");
  if (await git(sourceGitRoot, ["status", "--porcelain=v1", "--untracked-files=all"])) throw new Error("Source checkout must remain clean before targeted test generation");
  const initialChangedFiles = (await git(worktreePath, ["diff", "--name-only", "--"])).split("\n").filter(Boolean).sort();
  if (!isDeepStrictEqual(initialChangedFiles, ["package-lock.json", "package.json", sourceFile])) {
    throw new Error("Targeted test generation requires the exact repaired three-file checkpoint");
  }
  const dependencyDiff = await git(worktreePath, ["diff", "--no-ext-diff", "--unified=3", "--", "package-lock.json", "package.json"]);
  if (dependencyDiff !== dependencyUpdate.diff) throw new Error("Current dependency diff no longer matches the recorded update");
  const sourceDiff = await git(worktreePath, ["diff", "--no-ext-diff", "--unified=3", "--", sourceFile]);
  if (sourceDiff !== compatibilityRepair.sourceDiff) throw new Error("Current source diff no longer matches the recorded compatibility repair");

  const originalTest = await readBoundedFile(testPath);
  const sourceContent = await readBoundedFile(sourcePath);
  const context = createTargetedTestContext({
    proposal: options.proposal,
    dependencyUpdate,
    compatibilityRepair,
    sourceContent,
    testContent: originalTest,
  });
  const resolver = options.resolver ?? ((boundedContext) => resolveTargetedTest({ context: boundedContext, fixturePath: options.fixturePath }));
  const testRunner = options.testRunner ?? defaultTargetedTestRunner;
  const proposalRun = TargetedTestProposalRunSchema.parse(await resolver(context));
  const targetedTest = validateTargetedTest(proposalRun.proposal, context);
  let testMutated = false;

  const finish = async (
    status: TargetedTestResult["status"],
    commandResult: TargetedTestCommandResult | null,
    testRestored: boolean,
  ): Promise<TargetedTestResult> => {
    const changedFiles = (await git(worktreePath, ["diff", "--name-only", "--"])).split("\n").filter(Boolean).sort();
    const testDiff = await git(worktreePath, ["diff", "--no-ext-diff", "--unified=3", "--", testFile]);
    if (await git(sourceGitRoot, ["status", "--porcelain=v1", "--untracked-files=all"])) throw new Error("Source checkout changed during targeted test generation");
    const result = TargetedTestResultSchema.parse({
      runId: isolationRun.id,
      planId: isolationRun.planId,
      status,
      file: testFile,
      proposalRun,
      commandResult,
      changedFiles,
      sourceCheckoutClean: true,
      testRestored,
      testDiff,
      resultLogPath,
      completedAt: (options.now ?? new Date()).toISOString(),
    });
    await writeFile(resultLogPath, `${JSON.stringify(result, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    return result;
  };

  if (targetedTest.action !== "add_test") return finish("stopped", null, false);

  try {
    const nextTest = insertBeforeFinalSuiteClose(originalTest, targetedTest.testText!);
    await writeFile(testPath, nextTest, "utf8");
    testMutated = true;
    const commandResult = TargetedTestCommandResultSchema.parse(await testRunner(repositoryPath));
    if (commandResult.passed) return finish("test_added_passed", commandResult, false);
    await writeFile(testPath, originalTest, "utf8");
    testMutated = false;
    return finish("test_failed_restored", commandResult, true);
  } catch (error) {
    if (testMutated) await writeFile(testPath, originalTest, "utf8");
    throw error;
  }
}
