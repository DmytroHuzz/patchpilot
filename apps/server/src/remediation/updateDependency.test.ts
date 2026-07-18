import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import type { RemediationPlanRun, RemediationProposal } from "@patchpilot/contracts";
import { RemediationApprovalStore } from "./approvalGate.js";
import { createIsolatedGitWorkspace } from "./isolateRepository.js";
import { applyApprovedDependencyUpdate, type DependencyCommandRunner } from "./updateDependency.js";

const execFileAsync = promisify(execFile);
const temporaryRoots: string[] = [];
const runId = "run-00000000-0000-4000-8000-000000000009";

const planRun: RemediationPlanRun = {
  model: "gpt-5.6",
  source: "cached-demo",
  plan: {
    targetVersion: "1.0.2",
    strategy: "dependency_upgrade_and_code_change",
    explanation: "Upgrade json5 and apply a later compatibility repair.",
    expectedFiles: ["package.json", "package-lock.json", "src/theme.js", "test/theme.test.js"],
    expectedCompatibilityRisks: ["Parser behavior may change."],
    proposedCommands: ["npm install json5@1.0.2 --save-exact", "npm run test"],
    proposedTests: ["Run tests after the later compatibility repair."],
    requiresHumanApproval: true,
  },
};

const manifest = {
  name: "dependency-fixture",
  version: "1.0.0",
  private: true,
  dependencies: { json5: "1.0.1" },
};

const lockfile = {
  name: "dependency-fixture",
  version: "1.0.0",
  lockfileVersion: 3,
  requires: true,
  packages: {
    "": { name: "dependency-fixture", version: "1.0.0", dependencies: { json5: "1.0.1" } },
    "node_modules/json5": {
      version: "1.0.1",
      resolved: "https://registry.npmjs.org/json5/-/json5-1.0.1.tgz",
      integrity: "old-integrity",
      dependencies: { minimist: "^1.2.0" },
    },
    "node_modules/minimist": { version: "1.2.8", integrity: "unchanged-integrity" },
  },
};

async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", root, ...args], { encoding: "utf8" });
  return stdout.trim();
}

function approve(decision: "approved" | "cancelled" = "approved"): RemediationProposal {
  const store = new RemediationApprovalStore();
  const pending = store.register(planRun);
  return store.decide({ planId: pending.id, decision }, new Date("2026-07-18T10:00:00.000Z"));
}

async function createFixture() {
  const boundaryRoot = await mkdtemp(path.join(tmpdir(), "patchpilot-dependency-"));
  temporaryRoots.push(boundaryRoot);
  const sourceRoot = path.join(boundaryRoot, "source");
  await mkdir(path.join(sourceRoot, "src"), { recursive: true });
  await writeFile(path.join(sourceRoot, ".gitignore"), "node_modules/\n");
  await writeFile(path.join(sourceRoot, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(path.join(sourceRoot, "package-lock.json"), `${JSON.stringify(lockfile, null, 2)}\n`);
  await writeFile(path.join(sourceRoot, "src/theme.js"), "module.exports = {};\n");
  await git(sourceRoot, ["init", "-b", "main"]);
  await git(sourceRoot, ["config", "user.email", "patchpilot@example.test"]);
  await git(sourceRoot, ["config", "user.name", "PatchPilot Test"]);
  await git(sourceRoot, ["add", "."]);
  await git(sourceRoot, ["commit", "-m", "dependency baseline"]);
  const proposal = approve();
  const isolationRun = await createIsolatedGitWorkspace({
    proposal,
    repositoryPath: sourceRoot,
    boundaryRoot,
    worktreeRoot: path.join(boundaryRoot, "runs/worktrees"),
    auditRoot: path.join(boundaryRoot, "runs/audit"),
    runId,
    now: new Date("2026-07-18T10:01:00.000Z"),
  });
  return { boundaryRoot, sourceRoot, proposal, isolationRun };
}

function runner(options: { unrelatedLock?: boolean; extraFile?: boolean } = {}): DependencyCommandRunner {
  return async ({ cwd, executable, args }) => {
    const updatedManifest = JSON.parse(await readFile(path.join(cwd, "package.json"), "utf8"));
    const updatedLockfile = JSON.parse(await readFile(path.join(cwd, "package-lock.json"), "utf8"));
    updatedManifest.dependencies.json5 = "1.0.2";
    updatedLockfile.packages[""].dependencies.json5 = "1.0.2";
    updatedLockfile.packages["node_modules/json5"] = {
      version: "1.0.2",
      resolved: "https://registry.npmjs.org/json5/-/json5-1.0.2.tgz",
      integrity: "new-integrity",
      dependencies: { minimist: "^1.2.0" },
    };
    if (options.unrelatedLock) updatedLockfile.packages["node_modules/minimist"].version = "9.9.9";
    await writeFile(path.join(cwd, "package.json"), `${JSON.stringify(updatedManifest, null, 2)}\n`);
    await writeFile(path.join(cwd, "package-lock.json"), `${JSON.stringify(updatedLockfile, null, 2)}\n`);
    if (options.extraFile) await writeFile(path.join(cwd, "src/theme.js"), "module.exports = { changed: true };\n");
    return {
      command: `${executable} ${args.join(" ")}`,
      exitCode: 0,
      durationMs: 15,
      stdout: "changed 1 package",
      stderr: "",
      outputTruncated: false,
    };
  };
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("approved dependency update", () => {
  it("updates only json5 in the isolated worktree and preserves a review diff", async () => {
    const fixture = await createFixture();
    let observedCwd = "";
    const fakeRunner: DependencyCommandRunner = async (command) => {
      observedCwd = command.cwd;
      return runner()(command);
    };

    const result = await applyApprovedDependencyUpdate({
      ...fixture,
      resultRoot: path.join(fixture.boundaryRoot, "runs/audit"),
      commandRunner: fakeRunner,
      now: new Date("2026-07-18T10:02:00.000Z"),
    });

    expect(observedCwd).toBe(fixture.isolationRun.isolatedRepositoryPath);
    expect(result.commandResult.command).toBe("npm install json5@1.0.2 --save-exact");
    expect(result.fromVersion).toBe("1.0.1");
    expect(result.targetVersion).toBe("1.0.2");
    expect(result.changedFiles).toEqual(["package-lock.json", "package.json"]);
    expect(result.diff).toContain('"json5": "1.0.2"');
    expect(result.diff).not.toContain("src/theme.js");
    expect(JSON.parse(await readFile(result.resultLogPath, "utf8"))).toEqual(result);
    expect(await git(fixture.sourceRoot, ["status", "--porcelain=v1", "--untracked-files=all"])).toBe("");
    expect(JSON.parse(await readFile(path.join(fixture.sourceRoot, "package.json"), "utf8")).dependencies.json5).toBe("1.0.1");
  });

  it("fails closed when the proposal is no longer approved", async () => {
    const fixture = await createFixture();
    let invoked = false;
    await expect(applyApprovedDependencyUpdate({
      ...fixture,
      proposal: approve("cancelled"),
      resultRoot: path.join(fixture.boundaryRoot, "runs/audit"),
      commandRunner: async (command) => {
        invoked = true;
        return runner()(command);
      },
    })).rejects.toThrow("Explicit approval");
    expect(invoked).toBe(false);
  });

  it("rejects an unrelated lockfile dependency change", async () => {
    const fixture = await createFixture();
    await expect(applyApprovedDependencyUpdate({
      ...fixture,
      resultRoot: path.join(fixture.boundaryRoot, "runs/audit"),
      commandRunner: runner({ unrelatedLock: true }),
    })).rejects.toThrow("unrelated lockfile content");
    expect(await git(fixture.sourceRoot, ["status", "--porcelain=v1", "--untracked-files=all"])).toBe("");
  });

  it("rejects a source file change during the dependency-only step", async () => {
    const fixture = await createFixture();
    await expect(applyApprovedDependencyUpdate({
      ...fixture,
      resultRoot: path.join(fixture.boundaryRoot, "runs/audit"),
      commandRunner: runner({ extraFile: true }),
    })).rejects.toThrow("outside the approved dependency boundary");
    expect(await git(fixture.sourceRoot, ["status", "--porcelain=v1", "--untracked-files=all"])).toBe("");
  });
});
