import { execFile } from "node:child_process";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual, promisify } from "node:util";
import {
  CompatibilityRepairProposalRunSchema,
  CompatibilityRepairResultSchema,
  DependencyUpdateResultSchema,
  IsolationRunSchema,
  SyntaxProbeResultSchema,
  type CompatibilityRepairAttempt,
  type CompatibilityRepairProposalRun,
  type CompatibilityRepairResult,
  type DependencyUpdateResult,
  type IsolationRun,
  type RemediationProposal,
  type SyntaxProbeResult,
} from "@patchpilot/contracts";
import {
  createCompatibilityRepairContext,
  type CompatibilityRepairContext,
  type RelevantSyntaxFailure,
} from "../ai/compatibilityRepairContext.js";
import { resolveCompatibilityRepair } from "../ai/repairCompatibility.js";
import { validateCompatibilityRepair } from "../ai/validateCompatibilityRepair.js";
import { assertRemediationApproved } from "./approvalGate.js";
import { canonicalExistingPath, resolveInsideBoundary } from "./isolateRepository.js";

const execFileAsync = promisify(execFile);
const sourceFile = "src/theme.js" as const;
const probeCommand = "node --check src/theme.js" as const;

export type CompatibilityRepairResolver = (context: CompatibilityRepairContext) => Promise<CompatibilityRepairProposalRun>;
export type SyntaxProbeRunner = (repositoryPath: string) => Promise<SyntaxProbeResult>;

function redact(value: string): string {
  return value
    .replace(/\b(?:npm|gh[pousr])_[A-Za-z0-9_-]{20,}\b/g, "[REDACTED TOKEN]")
    .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, "[REDACTED TOKEN]")
    .replace(/(https?:\/\/[^\s/:@]+:)[^\s@]+@/g, "$1[REDACTED]@");
}

function bounded(value: string, limit = 4096): string {
  const redacted = redact(value);
  return redacted.length <= limit ? redacted : `${redacted.slice(0, limit - 28)}\n[output truncated by PatchPilot]`;
}

async function git(gitRoot: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", gitRoot, ...args], {
    encoding: "utf8",
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
  });
  return stdout.trim();
}

async function readBoundedSource(filePath: string): Promise<string> {
  const fileStat = await stat(filePath);
  if (!fileStat.isFile() || fileStat.size > 32 * 1024) throw new Error("Source file exceeds the 32 KiB repair boundary");
  return readFile(filePath, "utf8");
}

async function defaultSyntaxProbe(repositoryPath: string): Promise<SyntaxProbeResult> {
  const startedAt = Date.now();
  try {
    const { stdout, stderr } = await execFileAsync("node", ["--check", sourceFile], {
      cwd: repositoryPath,
      encoding: "utf8",
      timeout: 10_000,
      maxBuffer: 16 * 1024,
    });
    return SyntaxProbeResultSchema.parse({
      command: probeCommand,
      exitCode: 0,
      passed: true,
      durationMs: Date.now() - startedAt,
      stdout: bounded(stdout),
      stderr: bounded(stderr),
    });
  } catch (error) {
    const failure = error as Error & { code?: number | string; stdout?: string; stderr?: string };
    return SyntaxProbeResultSchema.parse({
      command: probeCommand,
      exitCode: typeof failure.code === "number" ? failure.code : 1,
      passed: false,
      durationMs: Date.now() - startedAt,
      stdout: bounded(failure.stdout ?? ""),
      stderr: bounded(failure.stderr ?? failure.message),
    });
  }
}

export function relevantSyntaxFailure(probe: SyntaxProbeResult, repositoryPath: string): RelevantSyntaxFailure {
  if (probe.passed || probe.command !== probeCommand) throw new Error("Only a failed bounded syntax probe may enter a retry context");
  const normalizedRoot = path.resolve(repositoryPath);
  const relevantLines = probe.stderr
    .replaceAll(path.join(normalizedRoot, sourceFile), sourceFile)
    .split("\n")
    .filter((line) => line.includes(sourceFile) || /^\s*\^+\s*$/.test(line) || /^SyntaxError:/.test(line.trim()))
    .slice(0, 12);
  return {
    command: probeCommand,
    exitCode: probe.exitCode,
    stderr: bounded(relevantLines.join("\n") || "Syntax probe failed without relevant bounded diagnostics."),
  };
}

export class CompatibilityRepairStore {
  readonly #resultsByRun = new Map<string, CompatibilityRepairResult>();

  register(result: CompatibilityRepairResult): CompatibilityRepairResult {
    const validated = CompatibilityRepairResultSchema.parse(result);
    const existing = this.#resultsByRun.get(validated.runId);
    if (existing) return existing;
    this.#resultsByRun.set(validated.runId, validated);
    return validated;
  }

  getByRun(runId: string): CompatibilityRepairResult | undefined {
    return this.#resultsByRun.get(runId);
  }
}

export async function runCompatibilityRepairLoop(options: {
  proposal: RemediationProposal;
  isolationRun: IsolationRun;
  dependencyUpdate: DependencyUpdateResult;
  boundaryRoot: string;
  resultRoot: string;
  fixturePath: string;
  now?: Date;
  resolver?: CompatibilityRepairResolver;
  syntaxProbe?: SyntaxProbeRunner;
}): Promise<CompatibilityRepairResult> {
  assertRemediationApproved(options.proposal);
  const isolationRun = IsolationRunSchema.parse(options.isolationRun);
  const dependencyUpdate = DependencyUpdateResultSchema.parse(options.dependencyUpdate);
  if (isolationRun.planId !== options.proposal.id || dependencyUpdate.planId !== options.proposal.id || dependencyUpdate.runId !== isolationRun.id) {
    throw new Error("Repair inputs do not belong to the same approved isolated run");
  }

  const boundaryRoot = path.resolve(options.boundaryRoot);
  const sourceGitRoot = await canonicalExistingPath(boundaryRoot, isolationRun.sourceGitRoot, "Source Git root");
  const worktreePath = await canonicalExistingPath(boundaryRoot, isolationRun.worktreePath, "Isolated worktree");
  const repositoryPath = await canonicalExistingPath(worktreePath, isolationRun.isolatedRepositoryPath, "Isolated repository");
  const resultRoot = await canonicalExistingPath(boundaryRoot, options.resultRoot, "Repair result root");
  const resultLogPath = resolveInsideBoundary(resultRoot, path.join(resultRoot, `${isolationRun.id}-compatibility-repair.json`), "Repair result log");
  const sourcePath = resolveInsideBoundary(repositoryPath, path.join(repositoryPath, sourceFile), "Repair source path");

  if (await git(worktreePath, ["branch", "--show-current"]) !== isolationRun.branchName) throw new Error("Repair worktree branch does not match the isolated run");
  if (await git(worktreePath, ["rev-parse", "HEAD"]) !== isolationRun.baselineCommit) throw new Error("Repair worktree baseline does not match the isolated run");
  const sourceStatusBefore = await git(sourceGitRoot, ["status", "--porcelain=v1", "--untracked-files=all"]);
  if (sourceStatusBefore) throw new Error("Source checkout must remain clean before compatibility repair");
  const initialChangedFiles = (await git(worktreePath, ["diff", "--name-only", "--"])).split("\n").filter(Boolean).sort();
  if (!isDeepStrictEqual(initialChangedFiles, ["package-lock.json", "package.json"])) {
    throw new Error("Compatibility repair requires the exact dependency-only checkpoint");
  }
  const currentDependencyDiff = await git(worktreePath, ["diff", "--no-ext-diff", "--unified=3", "--", "package-lock.json", "package.json"]);
  if (currentDependencyDiff !== dependencyUpdate.diff) throw new Error("Current dependency diff no longer matches the recorded update");

  const originalSource = await readBoundedSource(sourcePath);
  const attempts: CompatibilityRepairAttempt[] = [];
  let previousSyntaxFailure: RelevantSyntaxFailure | null = null;
  let sourceMutated = false;
  const resolver = options.resolver ?? ((context) => resolveCompatibilityRepair({ context, fixturePath: options.fixturePath }));
  const syntaxProbe = options.syntaxProbe ?? defaultSyntaxProbe;

  const finish = async (status: CompatibilityRepairResult["status"], sourceRestored: boolean): Promise<CompatibilityRepairResult> => {
    const changedFiles = (await git(worktreePath, ["diff", "--name-only", "--"])).split("\n").filter(Boolean).sort();
    const sourceDiff = await git(worktreePath, ["diff", "--no-ext-diff", "--unified=3", "--", sourceFile]);
    const sourceStatusAfter = await git(sourceGitRoot, ["status", "--porcelain=v1", "--untracked-files=all"]);
    if (sourceStatusAfter) throw new Error("Source checkout changed during compatibility repair");
    const result = CompatibilityRepairResultSchema.parse({
      runId: isolationRun.id,
      planId: isolationRun.planId,
      status,
      file: sourceFile,
      attempts,
      changedFiles,
      sourceCheckoutClean: true,
      sourceRestored,
      sourceDiff,
      resultLogPath,
      completedAt: (options.now ?? new Date()).toISOString(),
    });
    await writeFile(resultLogPath, `${JSON.stringify(result, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    return result;
  };

  try {
    for (const attempt of [1, 2] as const) {
      const currentSource = await readBoundedSource(sourcePath);
      const context = createCompatibilityRepairContext({
        proposal: options.proposal,
        dependencyUpdate,
        sourceContent: currentSource,
        attempt,
        previousSyntaxFailure,
      });
      const proposalRun = CompatibilityRepairProposalRunSchema.parse(await resolver(context));
      const repair = validateCompatibilityRepair(proposalRun.proposal, context);
      if (repair.action !== "apply_replacement") {
        if (sourceMutated) {
          await writeFile(sourcePath, originalSource, "utf8");
          sourceMutated = false;
        }
        attempts.push({ attempt, proposalRun, status: "stopped", probe: null });
        return finish("stopped", attempt > 1);
      }

      const occurrenceCount = currentSource.split(repair.oldText!).length - 1;
      if (occurrenceCount !== 1) throw new Error("Repair oldText must occur exactly once in the approved source file");
      await writeFile(sourcePath, currentSource.replace(repair.oldText!, repair.newText!), "utf8");
      sourceMutated = true;
      const probe = SyntaxProbeResultSchema.parse(await syntaxProbe(repositoryPath));
      attempts.push({
        attempt,
        proposalRun,
        status: probe.passed ? "applied_passed" : "applied_failed",
        probe,
      });
      if (probe.passed) return finish("repaired", false);
      previousSyntaxFailure = relevantSyntaxFailure(probe, repositoryPath);
    }

    await writeFile(sourcePath, originalSource, "utf8");
    sourceMutated = false;
    return finish("failed_after_two_attempts", true);
  } catch (error) {
    if (sourceMutated) await writeFile(sourcePath, originalSource, "utf8");
    throw error;
  }
}
