import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
  IsolationRunSchema,
  type IsolationAuditEvent,
  type IsolationRun,
  type RemediationProposal,
} from "@patchpilot/contracts";
import { assertRemediationApproved } from "./approvalGate.js";

const execFileAsync = promisify(execFile);
const gitTimeoutMs = 10_000;
const gitMaxBufferBytes = 1024 * 1024;

function isInside(parent: string, candidate: string, allowEqual = true): boolean {
  const relative = path.relative(parent, candidate);
  return (allowEqual && relative === "") || (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

export function resolveInsideBoundary(boundary: string, candidate: string, label: string): string {
  const resolvedBoundary = path.resolve(boundary);
  const resolvedCandidate = path.resolve(candidate);
  if (!isInside(resolvedBoundary, resolvedCandidate)) {
    throw new Error(`${label} must remain inside the validated boundary`);
  }
  return resolvedCandidate;
}

async function canonicalExistingPath(boundary: string, candidate: string, label: string): Promise<string> {
  const canonicalBoundary = await realpath(boundary);
  const canonical = await realpath(path.resolve(candidate));
  if (!isInside(canonicalBoundary, canonical)) {
    throw new Error(`${label} resolves outside the validated boundary`);
  }
  return canonical;
}

async function git(gitRoot: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", gitRoot, ...args], {
    encoding: "utf8",
    timeout: gitTimeoutMs,
    maxBuffer: gitMaxBufferBytes,
  });
  return stdout.trim();
}

function event(sequence: number, at: string, action: IsolationAuditEvent["action"], detail: string): IsolationAuditEvent {
  return { sequence, at, action, detail };
}

export class IsolationRunStore {
  readonly #runsByPlan = new Map<string, IsolationRun>();

  register(run: IsolationRun): IsolationRun {
    const validated = IsolationRunSchema.parse(run);
    const existing = this.#runsByPlan.get(validated.planId);
    if (existing) return existing;
    this.#runsByPlan.set(validated.planId, validated);
    return validated;
  }

  getByPlan(planId: string): IsolationRun | undefined {
    return this.#runsByPlan.get(planId);
  }
}

export async function createIsolatedGitWorkspace(options: {
  proposal: RemediationProposal;
  repositoryPath: string;
  boundaryRoot: string;
  worktreeRoot: string;
  auditRoot: string;
  runId?: string;
  now?: Date;
}): Promise<IsolationRun> {
  const approval = assertRemediationApproved(options.proposal);
  const createdAt = (options.now ?? new Date()).toISOString();
  const id = options.runId ?? `run-${randomUUID()}`;
  if (!/^run-[0-9a-f-]{36}$/.test(id)) throw new Error("Isolation run ID is invalid");

  const boundaryRoot = path.resolve(options.boundaryRoot);
  const canonicalBoundaryRoot = await realpath(boundaryRoot);
  const repositoryPath = await canonicalExistingPath(boundaryRoot, options.repositoryPath, "Repository path");
  const sourceGitRootOutput = await git(repositoryPath, ["rev-parse", "--show-toplevel"]);
  const sourceGitRoot = await canonicalExistingPath(boundaryRoot, sourceGitRootOutput, "Git root");
  if (!isInside(sourceGitRoot, repositoryPath)) {
    throw new Error("Repository path must be inside its validated Git root");
  }

  const worktreeRoot = resolveInsideBoundary(boundaryRoot, options.worktreeRoot, "Worktree root");
  const auditRoot = resolveInsideBoundary(boundaryRoot, options.auditRoot, "Audit root");
  const worktreePath = resolveInsideBoundary(worktreeRoot, path.join(worktreeRoot, id), "Worktree path");
  const auditLogPath = resolveInsideBoundary(auditRoot, path.join(auditRoot, `${id}.json`), "Audit log path");
  const repositoryRelativePath = path.relative(sourceGitRoot, repositoryPath);
  if (repositoryRelativePath.startsWith("..") || path.isAbsolute(repositoryRelativePath)) {
    throw new Error("Selected repository path escapes the Git worktree");
  }

  const dirtyOutput = await git(sourceGitRoot, ["status", "--porcelain=v1", "--untracked-files=all"]);
  if (dirtyOutput) {
    const changed = dirtyOutput.split("\n").slice(0, 6).join(", ");
    throw new Error(`Source checkout must be clean before isolation. Commit, stash, or remove these changes: ${changed}`);
  }

  const baselineCommit = await git(sourceGitRoot, ["rev-parse", "HEAD"]);
  const sourceBranch = await git(sourceGitRoot, ["branch", "--show-current"]) || "DETACHED";
  const branchName = `patchpilot/${id}`;
  let worktreeCreated = false;

  try {
    await mkdir(worktreeRoot, { recursive: true });
    await mkdir(auditRoot, { recursive: true });
    const canonicalWorktreeRoot = await realpath(worktreeRoot);
    const canonicalAuditRoot = await realpath(auditRoot);
    if (!isInside(canonicalBoundaryRoot, canonicalWorktreeRoot) || !isInside(canonicalBoundaryRoot, canonicalAuditRoot)) {
      throw new Error("Run storage resolves outside the validated boundary");
    }

    await git(sourceGitRoot, ["worktree", "add", "-b", branchName, worktreePath, baselineCommit]);
    worktreeCreated = true;
    const canonicalWorktreePath = await canonicalExistingPath(canonicalWorktreeRoot, worktreePath, "Created worktree");
    const isolatedCandidate = repositoryRelativePath === ""
      ? canonicalWorktreePath
      : path.join(canonicalWorktreePath, repositoryRelativePath);
    const isolatedRepositoryPath = await canonicalExistingPath(canonicalWorktreePath, isolatedCandidate, "Isolated repository");
    const isolatedBaseline = await git(canonicalWorktreePath, ["rev-parse", "HEAD"]);
    const isolatedBranch = await git(canonicalWorktreePath, ["branch", "--show-current"]);
    if (isolatedBaseline !== baselineCommit || isolatedBranch !== branchName) {
      throw new Error("Created worktree does not match the requested baseline and branch");
    }

    const events: IsolationAuditEvent[] = [
      event(1, createdAt, "approval_validated", `Exact plan ${options.proposal.id} is approved.`),
      event(2, createdAt, "paths_validated", "Source, worktree, isolated repository, and audit paths are boundary-contained."),
      event(3, createdAt, "clean_tree_validated", "Source Git checkout has no tracked or untracked changes."),
      event(4, createdAt, "baseline_captured", `Baseline ${baselineCommit.slice(0, 12)} captured from ${sourceBranch}.`),
      event(5, createdAt, "worktree_created", `Created ${branchName} at the approved baseline.`),
      event(6, createdAt, "workspace_ready", "Isolated repository is ready; no dependency or source patch has been applied."),
    ];
    const run = IsolationRunSchema.parse({
      id,
      planId: options.proposal.id,
      status: "ready",
      sourceRepositoryPath: repositoryPath,
      sourceGitRoot,
      sourceBranch,
      baselineCommit,
      branchName,
      worktreePath: canonicalWorktreePath,
      isolatedRepositoryPath,
      auditLogPath,
      sourceTreeClean: true,
      createdAt,
      approval,
      events,
    });
    await writeFile(auditLogPath, `${JSON.stringify(run, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    return run;
  } catch (error) {
    if (worktreeCreated) {
      await git(sourceGitRoot, ["worktree", "remove", "--force", worktreePath]).catch(() => undefined);
      await git(sourceGitRoot, ["branch", "-D", branchName]).catch(() => undefined);
    }
    throw error;
  }
}

export async function removeIsolatedGitWorkspace(options: {
  run: IsolationRun;
  boundaryRoot: string;
  deleteBranch?: boolean;
  deleteAudit?: boolean;
}): Promise<void> {
  const run = IsolationRunSchema.parse(options.run);
  const boundaryRoot = path.resolve(options.boundaryRoot);
  const sourceGitRoot = await canonicalExistingPath(boundaryRoot, run.sourceGitRoot, "Git root");
  const worktreePath = await canonicalExistingPath(boundaryRoot, run.worktreePath, "Worktree path");
  await git(sourceGitRoot, ["worktree", "remove", "--force", worktreePath]);
  if (options.deleteBranch) await git(sourceGitRoot, ["branch", "-D", run.branchName]);
  if (options.deleteAudit) {
    const auditLogPath = await canonicalExistingPath(boundaryRoot, run.auditLogPath, "Audit log path");
    await stat(auditLogPath);
    await rm(auditLogPath);
  }
}
