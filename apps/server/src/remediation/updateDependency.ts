import { execFile } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual, promisify } from "node:util";
import {
  DependencyUpdateResultSchema,
  IsolationRunSchema,
  type DependencyCommandResult,
  type DependencyUpdateResult,
  type IsolationRun,
  type RemediationProposal,
} from "@patchpilot/contracts";
import { assertRemediationApproved } from "./approvalGate.js";
import { canonicalExistingPath, resolveInsideBoundary } from "./isolateRepository.js";

const execFileAsync = promisify(execFile);
const commandTimeoutMs = 60_000;
const commandMaxBufferBytes = 512 * 1024;
const outputLimit = 32 * 1024;
const diffLimit = 64 * 1024;

type JsonObject = Record<string, unknown>;

export type DependencyCommandRunner = (options: {
  cwd: string;
  executable: "npm";
  args: ["install", string, "--save-exact"];
}) => Promise<DependencyCommandResult>;

function asObject(value: unknown, label: string): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a JSON object`);
  return value as JsonObject;
}

function asStringMap(value: unknown, label: string): Record<string, string> {
  const object = asObject(value, label);
  for (const [key, entry] of Object.entries(object)) {
    if (typeof entry !== "string") throw new Error(`${label}.${key} must be a string`);
  }
  return object as Record<string, string>;
}

async function readBoundedJson(filePath: string, label: string): Promise<JsonObject> {
  const fileStat = await stat(filePath);
  if (!fileStat.isFile() || fileStat.size > 256 * 1024) throw new Error(`${label} exceeds the 256 KiB JSON boundary`);
  try {
    return asObject(JSON.parse(await readFile(filePath, "utf8")), label);
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`${label} must contain valid JSON`);
    throw error;
  }
}

function manifestVersion(manifest: JsonObject, packageName: string): string {
  const dependencies = asStringMap(manifest.dependencies, "package.json dependencies");
  const version = dependencies[packageName];
  if (!version) throw new Error(`package.json must declare direct dependency ${packageName}`);
  return version;
}

function lockVersion(lockfile: JsonObject, packageName: string): string {
  const packages = asObject(lockfile.packages, "package-lock.json packages");
  const rootPackage = asObject(packages[""], "package-lock.json root package");
  const rootDependencies = asStringMap(rootPackage.dependencies, "package-lock.json root dependencies");
  const lockedPackage = asObject(packages[`node_modules/${packageName}`], `package-lock.json ${packageName} package`);
  const version = lockedPackage.version;
  if (rootDependencies[packageName] === undefined || typeof version !== "string") {
    throw new Error(`package-lock.json must contain direct dependency ${packageName}`);
  }
  if (rootDependencies[packageName] !== version) throw new Error(`package-lock.json root and package versions disagree for ${packageName}`);
  return version;
}

function withoutTargetDependency(document: JsonObject, packageName: string, lockfile: boolean): JsonObject {
  const copy = structuredClone(document);
  if (!lockfile) {
    const dependencies = asObject(copy.dependencies, "package.json dependencies");
    delete dependencies[packageName];
    return copy;
  }
  const packages = asObject(copy.packages, "package-lock.json packages");
  const rootPackage = asObject(packages[""], "package-lock.json root package");
  const rootDependencies = asObject(rootPackage.dependencies, "package-lock.json root dependencies");
  delete rootDependencies[packageName];
  delete packages[`node_modules/${packageName}`];
  return copy;
}

async function git(gitRoot: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", gitRoot, ...args], {
    encoding: "utf8",
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
  });
  return stdout.trim();
}

function boundedOutput(value: string): { value: string; truncated: boolean } {
  const redacted = value
    .replace(/\b(?:npm|gh[pousr])_[A-Za-z0-9_-]{20,}\b/g, "[REDACTED TOKEN]")
    .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, "[REDACTED TOKEN]")
    .replace(/(https?:\/\/[^\s/:@]+:)[^\s@]+@/g, "$1[REDACTED]@");
  if (redacted.length <= outputLimit) return { value: redacted, truncated: false };
  return { value: `${redacted.slice(0, outputLimit - 28)}\n[output truncated by PatchPilot]`, truncated: true };
}

async function defaultCommandRunner(options: {
  cwd: string;
  executable: "npm";
  args: ["install", string, "--save-exact"];
}): Promise<DependencyCommandResult> {
  const startedAt = Date.now();
  try {
    const { stdout, stderr } = await execFileAsync(options.executable, options.args, {
      cwd: options.cwd,
      encoding: "utf8",
      timeout: commandTimeoutMs,
      maxBuffer: commandMaxBufferBytes,
      env: { ...process.env, NO_UPDATE_NOTIFIER: "1" },
    });
    const boundedStdout = boundedOutput(stdout);
    const boundedStderr = boundedOutput(stderr);
    return {
      command: `${options.executable} ${options.args.join(" ")}`,
      exitCode: 0,
      durationMs: Date.now() - startedAt,
      stdout: boundedStdout.value,
      stderr: boundedStderr.value,
      outputTruncated: boundedStdout.truncated || boundedStderr.truncated,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown npm failure";
    throw new Error(`Approved dependency command failed: ${boundedOutput(message).value.slice(0, 1000)}`);
  }
}

export class DependencyUpdateStore {
  readonly #resultsByRun = new Map<string, DependencyUpdateResult>();

  register(result: DependencyUpdateResult): DependencyUpdateResult {
    const validated = DependencyUpdateResultSchema.parse(result);
    const existing = this.#resultsByRun.get(validated.runId);
    if (existing) return existing;
    this.#resultsByRun.set(validated.runId, validated);
    return validated;
  }

  getByRun(runId: string): DependencyUpdateResult | undefined {
    return this.#resultsByRun.get(runId);
  }
}

export async function applyApprovedDependencyUpdate(options: {
  proposal: RemediationProposal;
  isolationRun: IsolationRun;
  boundaryRoot: string;
  resultRoot: string;
  packageName?: "json5";
  now?: Date;
  commandRunner?: DependencyCommandRunner;
}): Promise<DependencyUpdateResult> {
  assertRemediationApproved(options.proposal);
  const isolationRun = IsolationRunSchema.parse(options.isolationRun);
  if (isolationRun.planId !== options.proposal.id) throw new Error("Isolation run does not belong to the approved remediation plan");

  const packageName = options.packageName ?? "json5";
  const targetVersion = options.proposal.planRun.plan.targetVersion;
  const approvedCommand = `npm install ${packageName}@${targetVersion} --save-exact`;
  if (!options.proposal.planRun.plan.proposedCommands.includes(approvedCommand)) {
    throw new Error("Exact dependency command is not present in the approved remediation plan");
  }

  const boundaryRoot = path.resolve(options.boundaryRoot);
  const sourceGitRoot = await canonicalExistingPath(boundaryRoot, isolationRun.sourceGitRoot, "Source Git root");
  const worktreePath = await canonicalExistingPath(boundaryRoot, isolationRun.worktreePath, "Isolated worktree");
  const isolatedRepositoryPath = await canonicalExistingPath(worktreePath, isolationRun.isolatedRepositoryPath, "Isolated repository");
  const resultRoot = await canonicalExistingPath(boundaryRoot, options.resultRoot, "Dependency result root");
  const resultLogPath = resolveInsideBoundary(resultRoot, path.join(resultRoot, `${isolationRun.id}-dependency-update.json`), "Dependency result log");

  const isolatedGitRoot = await canonicalExistingPath(worktreePath, await git(isolatedRepositoryPath, ["rev-parse", "--show-toplevel"]), "Isolated Git root");
  if (isolatedGitRoot !== worktreePath) throw new Error("Isolated repository is attached to an unexpected Git root");
  if (await git(worktreePath, ["branch", "--show-current"]) !== isolationRun.branchName) throw new Error("Isolated branch no longer matches the recorded run");
  if (await git(worktreePath, ["rev-parse", "HEAD"]) !== isolationRun.baselineCommit) throw new Error("Isolated worktree no longer matches the recorded baseline");
  const preStatus = await git(worktreePath, ["status", "--porcelain=v1", "--untracked-files=all"]);
  if (preStatus) throw new Error(`Isolated worktree must be clean before the dependency update: ${preStatus.split("\n").slice(0, 6).join(", ")}`);
  const sourceStatusBefore = await git(sourceGitRoot, ["status", "--porcelain=v1", "--untracked-files=all"]);
  if (sourceStatusBefore) throw new Error("Source checkout changed after isolation and must be reviewed before patching");

  const manifestPath = resolveInsideBoundary(isolatedRepositoryPath, path.join(isolatedRepositoryPath, "package.json"), "Manifest path");
  const lockfilePath = resolveInsideBoundary(isolatedRepositoryPath, path.join(isolatedRepositoryPath, "package-lock.json"), "Lockfile path");
  const beforeManifest = await readBoundedJson(manifestPath, "package.json");
  const beforeLockfile = await readBoundedJson(lockfilePath, "package-lock.json");
  const fromVersion = manifestVersion(beforeManifest, packageName);
  if (lockVersion(beforeLockfile, packageName) !== fromVersion) throw new Error("Manifest and lockfile disagree before the dependency update");
  if (fromVersion === targetVersion) throw new Error(`${packageName} is already at the approved target version`);

  const runner = options.commandRunner ?? defaultCommandRunner;
  const commandResult = await runner({
    cwd: isolatedRepositoryPath,
    executable: "npm",
    args: ["install", `${packageName}@${targetVersion}`, "--save-exact"],
  });
  if (commandResult.command !== approvedCommand || commandResult.exitCode !== 0) {
    throw new Error("Dependency runner did not execute the exact approved command successfully");
  }

  const afterManifest = await readBoundedJson(manifestPath, "package.json");
  const afterLockfile = await readBoundedJson(lockfilePath, "package-lock.json");
  const manifestTarget = manifestVersion(afterManifest, packageName);
  const lockfileTarget = lockVersion(afterLockfile, packageName);
  if (manifestTarget !== targetVersion || lockfileTarget !== targetVersion) {
    throw new Error("Manifest and lockfile did not both reach the approved target version");
  }
  if (!isDeepStrictEqual(
    withoutTargetDependency(beforeManifest, packageName, false),
    withoutTargetDependency(afterManifest, packageName, false),
  )) throw new Error("Dependency update changed unrelated manifest content");
  if (!isDeepStrictEqual(
    withoutTargetDependency(beforeLockfile, packageName, true),
    withoutTargetDependency(afterLockfile, packageName, true),
  )) throw new Error("Dependency update changed unrelated lockfile content");

  const changedFiles = (await git(worktreePath, ["diff", "--name-only", "--"])).split("\n").filter(Boolean).sort();
  if (!isDeepStrictEqual(changedFiles, ["package-lock.json", "package.json"])) {
    throw new Error(`Dependency update changed files outside the approved dependency boundary: ${changedFiles.join(", ") || "none"}`);
  }
  const diff = await git(worktreePath, ["diff", "--no-ext-diff", "--unified=3", "--", "package-lock.json", "package.json"]);
  if (!diff || diff.length > diffLimit) throw new Error("Dependency diff is empty or exceeds the 64 KiB review boundary");
  const sourceStatusAfter = await git(sourceGitRoot, ["status", "--porcelain=v1", "--untracked-files=all"]);
  if (sourceStatusAfter) throw new Error("Source checkout changed during the isolated dependency update");

  await mkdir(resultRoot, { recursive: true });
  const result = DependencyUpdateResultSchema.parse({
    runId: isolationRun.id,
    planId: isolationRun.planId,
    status: "dependency_updated",
    packageName,
    fromVersion,
    targetVersion,
    manifestVersion: manifestTarget,
    lockfileVersion: lockfileTarget,
    changedFiles,
    unrelatedDependenciesChanged: false,
    sourceCheckoutClean: true,
    commandResult,
    diff,
    resultLogPath,
    completedAt: (options.now ?? new Date()).toISOString(),
  });
  await writeFile(resultLogPath, `${JSON.stringify(result, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  return result;
}
