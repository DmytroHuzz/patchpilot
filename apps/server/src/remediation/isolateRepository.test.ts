import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import type { RemediationPlanRun, RemediationProposal } from "@patchpilot/contracts";
import { RemediationApprovalStore } from "./approvalGate.js";
import {
  createIsolatedGitWorkspace,
  removeIsolatedGitWorkspace,
  resolveInsideBoundary,
} from "./isolateRepository.js";

const execFileAsync = promisify(execFile);
const temporaryRoots: string[] = [];
const fixedRunId = "run-00000000-0000-4000-8000-000000000008";

const planRun: RemediationPlanRun = {
  model: "gpt-5.6",
  source: "cached-demo",
  plan: {
    targetVersion: "1.0.2",
    strategy: "dependency_upgrade_and_code_change",
    explanation: "Upgrade and narrow copied theme fields.",
    expectedFiles: ["package.json", "package-lock.json", "src/theme.js", "test/theme.test.js"],
    expectedCompatibilityRisks: ["Unknown theme keys will be dropped."],
    proposedCommands: ["npm install json5@1.0.2 --save-exact", "npm run test"],
    proposedTests: ["Run existing and targeted tests."],
    requiresHumanApproval: true,
  },
};

async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", root, ...args], { encoding: "utf8" });
  return stdout.trim();
}

async function createRepository(): Promise<{ boundaryRoot: string; sourceRoot: string; repositoryPath: string }> {
  const boundaryRoot = await mkdtemp(path.join(tmpdir(), "patchpilot-isolation-"));
  temporaryRoots.push(boundaryRoot);
  const sourceRoot = path.join(boundaryRoot, "source");
  const repositoryPath = path.join(sourceRoot, "demo");
  await mkdir(repositoryPath, { recursive: true });
  await git(sourceRoot, ["init", "-b", "main"]);
  await git(sourceRoot, ["config", "user.email", "patchpilot@example.test"]);
  await git(sourceRoot, ["config", "user.name", "PatchPilot Test"]);
  await writeFile(path.join(repositoryPath, "package.json"), "{\"name\":\"fixture\"}\n");
  await git(sourceRoot, ["add", "."]);
  await git(sourceRoot, ["commit", "-m", "fixture baseline"]);
  return { boundaryRoot, sourceRoot, repositoryPath };
}

function proposal(decision: "approved" | "cancelled" | "awaiting_approval" = "approved"): RemediationProposal {
  const store = new RemediationApprovalStore();
  const pending = store.register(planRun);
  if (decision === "awaiting_approval") return pending;
  return store.decide({ planId: pending.id, decision }, new Date("2026-07-18T10:00:00.000Z"));
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("isolated Git workspace", () => {
  it("fails before any filesystem write without exact approval", async () => {
    const fixture = await createRepository();
    const worktreeRoot = path.join(fixture.boundaryRoot, "runs/worktrees");

    await expect(createIsolatedGitWorkspace({
      ...fixture,
      proposal: proposal("awaiting_approval"),
      worktreeRoot,
      auditRoot: path.join(fixture.boundaryRoot, "runs/audit"),
      runId: fixedRunId,
    })).rejects.toThrow("Explicit approval");
    await expect(access(worktreeRoot)).rejects.toThrow();
  });

  it("rejects a dirty source checkout with an actionable message", async () => {
    const fixture = await createRepository();
    await writeFile(path.join(fixture.repositoryPath, "dirty.txt"), "uncommitted\n");

    await expect(createIsolatedGitWorkspace({
      ...fixture,
      proposal: proposal(),
      worktreeRoot: path.join(fixture.boundaryRoot, "runs/worktrees"),
      auditRoot: path.join(fixture.boundaryRoot, "runs/audit"),
      runId: fixedRunId,
    })).rejects.toThrow("Commit, stash, or remove these changes: ?? demo/dirty.txt");
    expect(await git(fixture.sourceRoot, ["branch", "--list", "patchpilot/*"])).toBe("");
    await expect(access(path.join(fixture.boundaryRoot, "runs"))).rejects.toThrow();
  });

  it("creates a boundary-contained branch/worktree without disturbing the source checkout", async () => {
    const fixture = await createRepository();
    const sourceHead = await git(fixture.sourceRoot, ["rev-parse", "HEAD"]);
    const sourceBranch = await git(fixture.sourceRoot, ["branch", "--show-current"]);
    const run = await createIsolatedGitWorkspace({
      ...fixture,
      proposal: proposal(),
      worktreeRoot: path.join(fixture.boundaryRoot, "runs/worktrees"),
      auditRoot: path.join(fixture.boundaryRoot, "runs/audit"),
      runId: fixedRunId,
      now: new Date("2026-07-18T10:01:00.000Z"),
    });

    expect(run.baselineCommit).toBe(sourceHead);
    expect(run.sourceBranch).toBe(sourceBranch);
    expect(run.branchName).toBe(`patchpilot/${fixedRunId}`);
    expect(run.isolatedRepositoryPath.startsWith(`${run.worktreePath}${path.sep}`)).toBe(true);
    expect(await git(run.worktreePath, ["branch", "--show-current"])).toBe(run.branchName);
    expect(await git(run.worktreePath, ["rev-parse", "HEAD"])).toBe(sourceHead);
    expect(await git(fixture.sourceRoot, ["status", "--porcelain=v1", "--untracked-files=all"])).toBe("");

    const audit = JSON.parse(await readFile(run.auditLogPath, "utf8"));
    expect(audit.events.map(({ action }: { action: string }) => action)).toEqual([
      "approval_validated",
      "paths_validated",
      "clean_tree_validated",
      "baseline_captured",
      "worktree_created",
      "workspace_ready",
    ]);

    await writeFile(path.join(run.isolatedRepositoryPath, "isolated-only.txt"), "isolated\n");
    await expect(access(path.join(fixture.repositoryPath, "isolated-only.txt"))).rejects.toThrow();
    expect(await git(fixture.sourceRoot, ["branch", "--show-current"])).toBe(sourceBranch);
    expect(await git(fixture.sourceRoot, ["rev-parse", "HEAD"])).toBe(sourceHead);

    await removeIsolatedGitWorkspace({
      run,
      boundaryRoot: fixture.boundaryRoot,
      deleteBranch: true,
      deleteAudit: true,
    });
    expect(await git(fixture.sourceRoot, ["branch", "--list", run.branchName])).toBe("");
  });

  it("rejects path traversal and storage outside the validated boundary", async () => {
    const fixture = await createRepository();
    expect(() => resolveInsideBoundary(fixture.boundaryRoot, path.join(fixture.boundaryRoot, "../escape"), "Candidate")).toThrow("validated boundary");

    await expect(createIsolatedGitWorkspace({
      ...fixture,
      proposal: proposal(),
      worktreeRoot: path.join(fixture.boundaryRoot, "../worktrees"),
      auditRoot: path.join(fixture.boundaryRoot, "runs/audit"),
      runId: fixedRunId,
    })).rejects.toThrow("Worktree root must remain inside the validated boundary");
  });
});
