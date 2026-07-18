import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import type {
  CompatibilityRepairProposalRun,
  RemediationPlanRun,
  SyntaxProbeResult,
} from "@patchpilot/contracts";
import type { CompatibilityRepairContext } from "../ai/compatibilityRepairContext.js";
import { RemediationApprovalStore } from "./approvalGate.js";
import { createIsolatedGitWorkspace } from "./isolateRepository.js";
import { runCompatibilityRepairLoop } from "./repairCompatibilityLoop.js";
import { applyApprovedDependencyUpdate, type DependencyCommandRunner } from "./updateDependency.js";

const execFileAsync = promisify(execFile);
const temporaryRoots: string[] = [];
const runId = "run-00000000-0000-4000-8000-000000000010";
const originalFunction = `function parseUserTheme(rawTheme) {
  const userTheme = JSON5.parse(rawTheme);

  return {
    ...DEFAULT_THEME,
    ...userTheme,
  };
}`;
const originalSource = `const JSON5 = require("json5");

const DEFAULT_THEME = Object.freeze({
  accent: "#75f2b3",
  density: "comfortable",
});

${originalFunction}

module.exports = { parseUserTheme };
`;

const planRun: RemediationPlanRun = {
  model: "gpt-5.6",
  source: "cached-demo",
  plan: {
    targetVersion: "1.0.2",
    strategy: "dependency_upgrade_and_code_change",
    explanation: "Upgrade json5 and copy only supported theme fields.",
    expectedFiles: ["package.json", "package-lock.json", "src/theme.js", "test/theme.test.js"],
    expectedCompatibilityRisks: ["Unknown theme keys will be dropped."],
    proposedCommands: ["npm install json5@1.0.2 --save-exact", "npm run test"],
    proposedTests: ["Run existing and targeted tests later."],
    requiresHumanApproval: true,
  },
};

const manifest = { name: "repair-fixture", version: "1.0.0", private: true, dependencies: { json5: "1.0.1" } };
const lockfile = {
  name: "repair-fixture",
  version: "1.0.0",
  lockfileVersion: 3,
  requires: true,
  packages: {
    "": { name: "repair-fixture", version: "1.0.0", dependencies: { json5: "1.0.1" } },
    "node_modules/json5": { version: "1.0.1", integrity: "old", dependencies: { minimist: "^1.2.0" } },
    "node_modules/minimist": { version: "1.2.8", integrity: "unchanged" },
  },
};

async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", root, ...args], { encoding: "utf8" });
  return stdout.trim();
}

const dependencyRunner: DependencyCommandRunner = async ({ cwd, executable, args }) => {
  const nextManifest = JSON.parse(await readFile(path.join(cwd, "package.json"), "utf8"));
  const nextLockfile = JSON.parse(await readFile(path.join(cwd, "package-lock.json"), "utf8"));
  nextManifest.dependencies.json5 = "1.0.2";
  nextLockfile.packages[""].dependencies.json5 = "1.0.2";
  nextLockfile.packages["node_modules/json5"] = {
    version: "1.0.2",
    integrity: "new",
    dependencies: { minimist: "^1.2.0" },
  };
  await writeFile(path.join(cwd, "package.json"), `${JSON.stringify(nextManifest, null, 2)}\n`);
  await writeFile(path.join(cwd, "package-lock.json"), `${JSON.stringify(nextLockfile, null, 2)}\n`);
  return {
    command: `${executable} ${args.join(" ")}`,
    exitCode: 0,
    durationMs: 10,
    stdout: "changed 1 package",
    stderr: "",
    outputTruncated: false,
  };
};

async function createFixture() {
  const boundaryRoot = await mkdtemp(path.join(tmpdir(), "patchpilot-repair-"));
  temporaryRoots.push(boundaryRoot);
  const sourceRoot = path.join(boundaryRoot, "source");
  await mkdir(path.join(sourceRoot, "src"), { recursive: true });
  await writeFile(path.join(sourceRoot, ".gitignore"), "node_modules/\n");
  await writeFile(path.join(sourceRoot, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(path.join(sourceRoot, "package-lock.json"), `${JSON.stringify(lockfile, null, 2)}\n`);
  await writeFile(path.join(sourceRoot, "src/theme.js"), originalSource);
  await git(sourceRoot, ["init", "-b", "main"]);
  await git(sourceRoot, ["config", "user.email", "patchpilot@example.test"]);
  await git(sourceRoot, ["config", "user.name", "PatchPilot Test"]);
  await git(sourceRoot, ["add", "."]);
  await git(sourceRoot, ["commit", "-m", "repair baseline"]);
  const store = new RemediationApprovalStore();
  const pending = store.register(planRun);
  const proposal = store.decide({ planId: pending.id, decision: "approved" }, new Date("2026-07-18T10:00:00.000Z"));
  const auditRoot = path.join(boundaryRoot, "runs/audit");
  const isolationRun = await createIsolatedGitWorkspace({
    proposal,
    repositoryPath: sourceRoot,
    boundaryRoot,
    worktreeRoot: path.join(boundaryRoot, "runs/worktrees"),
    auditRoot,
    runId,
  });
  const dependencyUpdate = await applyApprovedDependencyUpdate({
    proposal,
    isolationRun,
    boundaryRoot,
    resultRoot: auditRoot,
    commandRunner: dependencyRunner,
  });
  return { boundaryRoot, sourceRoot, auditRoot, proposal, isolationRun, dependencyUpdate };
}

function proposalFor(context: CompatibilityRepairContext, broken = false): CompatibilityRepairProposalRun {
  const newText = `function parseUserTheme(rawTheme) {
  const userTheme = JSON5.parse(rawTheme);${broken ? "\n  const broken = ;" : ""}

  return {
    accent: typeof userTheme.accent === "string" ? userTheme.accent : DEFAULT_THEME.accent,
    density: typeof userTheme.density === "string" ? userTheme.density : DEFAULT_THEME.density,
  };
}`;
  return {
    model: "gpt-5.6",
    source: "cached-demo",
    proposal: {
      attempt: context.attempt,
      action: "apply_replacement",
      classification: context.attempt === 1 ? "planned_source_hardening" : "upgrade_compatibility_failure",
      explanation: "Copy only supported theme fields.",
      file: "src/theme.js",
      oldText: context.source.functionText,
      newText,
      compatibilityRisks: ["Unknown fields will be dropped."],
      remainingUnknowns: ["Runtime callers may expect unknown fields."],
    },
  };
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("compatibility repair loop", () => {
  it("applies the golden source hardening once inside the isolated branch", async () => {
    const fixture = await createFixture();
    const result = await runCompatibilityRepairLoop({
      ...fixture,
      resultRoot: fixture.auditRoot,
      fixturePath: "unused-in-test.json",
      resolver: async (context) => proposalFor(context),
      now: new Date("2026-07-18T10:05:00.000Z"),
    });

    expect(result.status).toBe("repaired");
    expect(result.attempts).toHaveLength(1);
    expect(result.changedFiles).toEqual(["package-lock.json", "package.json", "src/theme.js"]);
    expect(result.sourceDiff).toContain("typeof userTheme.accent");
    expect(result.sourceDiff).not.toContain("test/theme.test.js");
    expect(await git(fixture.sourceRoot, ["status", "--porcelain=v1", "--untracked-files=all"])).toBe("");
    expect(await readFile(path.join(fixture.sourceRoot, "src/theme.js"), "utf8")).toBe(originalSource);
    expect(JSON.parse(await readFile(result.resultLogPath, "utf8"))).toEqual(result);
  });

  it("passes only relevant bounded syntax failure lines to attempt two and then restores source", async () => {
    const fixture = await createFixture();
    const contexts: CompatibilityRepairContext[] = [];
    let probes = 0;
    const failedProbe: SyntaxProbeResult = {
      command: "node --check src/theme.js",
      exitCode: 1,
      passed: false,
      durationMs: 4,
      stdout: "",
      stderr: `${path.join(fixture.isolationRun.isolatedRepositoryPath, "src/theme.js")}:3\n  ^\nSyntaxError: npm_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345\nUNRELATED /tmp/other.js secret-value`,
    };

    const result = await runCompatibilityRepairLoop({
      ...fixture,
      resultRoot: fixture.auditRoot,
      fixturePath: "unused-in-test.json",
      resolver: async (context) => {
        contexts.push(context);
        return proposalFor(context, true);
      },
      syntaxProbe: async () => {
        probes += 1;
        return failedProbe;
      },
    });

    expect(result.status).toBe("failed_after_two_attempts");
    expect(result.attempts).toHaveLength(2);
    expect(probes).toBe(2);
    expect(contexts[0]!.previousSyntaxFailure).toBeNull();
    expect(contexts[1]!.previousSyntaxFailure?.stderr).toContain("src/theme.js:3");
    expect(contexts[1]!.previousSyntaxFailure?.stderr).toContain("[REDACTED TOKEN]");
    expect(contexts[1]!.previousSyntaxFailure?.stderr).not.toContain("other.js");
    expect(contexts[1]!.previousSyntaxFailure?.stderr).not.toContain("secret-value");
    expect(result.sourceRestored).toBe(true);
    expect(result.sourceDiff).toBe("");
    expect(result.changedFiles).toEqual(["package-lock.json", "package.json"]);
    expect(await readFile(path.join(fixture.isolationRun.isolatedRepositoryPath, "src/theme.js"), "utf8")).toBe(originalSource);
  });

  it("stops without a source write when the failure is classified as unrelated", async () => {
    const fixture = await createFixture();
    let probes = 0;
    const result = await runCompatibilityRepairLoop({
      ...fixture,
      resultRoot: fixture.auditRoot,
      fixturePath: "unused-in-test.json",
      resolver: async (context) => ({
        model: "gpt-5.6",
        source: "cached-demo",
        proposal: {
          attempt: context.attempt,
          action: "stop_unrelated",
          classification: "unrelated_failure",
          explanation: "The supplied failure is outside the approved source boundary.",
          file: null,
          oldText: null,
          newText: null,
          compatibilityRisks: ["The unrelated failure remains unresolved."],
          remainingUnknowns: ["Its root cause was not investigated inside this bounded step."],
        },
      }),
      syntaxProbe: async () => {
        probes += 1;
        throw new Error("A stopped proposal must not run a syntax probe");
      },
    });

    expect(result.status).toBe("stopped");
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0]?.status).toBe("stopped");
    expect(probes).toBe(0);
    expect(result.sourceRestored).toBe(false);
    expect(result.sourceDiff).toBe("");
    expect(result.changedFiles).toEqual(["package-lock.json", "package.json"]);
    expect(await readFile(path.join(fixture.isolationRun.isolatedRepositoryPath, "src/theme.js"), "utf8")).toBe(originalSource);
  });
});
