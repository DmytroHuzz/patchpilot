import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import type {
  RemediationPlanRun,
  TargetedTestCommandResult,
  TargetedTestProposalRun,
} from "@patchpilot/contracts";
import type { CompatibilityRepairContext } from "../ai/compatibilityRepairContext.js";
import type { TargetedTestContext } from "../ai/targetedTestContext.js";
import { RemediationApprovalStore } from "./approvalGate.js";
import { generateTargetedRegressionTest, insertBeforeFinalSuiteClose } from "./generateTargetedRegressionTest.js";
import { createIsolatedGitWorkspace } from "./isolateRepository.js";
import { runCompatibilityRepairLoop } from "./repairCompatibilityLoop.js";
import { applyApprovedDependencyUpdate, type DependencyCommandRunner } from "./updateDependency.js";

const execFileAsync = promisify(execFile);
const temporaryRoots: string[] = [];
const runId = "run-00000000-0000-4000-8000-000000000011";
const originalSource = `const JSON5 = require("json5");

const DEFAULT_THEME = Object.freeze({
  accent: "#75f2b3",
  density: "comfortable",
});

function parseUserTheme(rawTheme) {
  const userTheme = JSON5.parse(rawTheme);

  return {
    ...DEFAULT_THEME,
    ...userTheme,
  };
}

module.exports = { parseUserTheme };
`;
const originalTest = `const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { parseUserTheme } = require("../src/theme");

describe("theme preview", () => {
  it("supplies defaults", () => {
    assert.deepEqual(parseUserTheme("{}"), { accent: "#75f2b3", density: "comfortable" });
  });
});
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
    proposedTests: ["Add a targeted test showing that unsupported input keys are not copied into the returned theme."],
    requiresHumanApproval: true,
  },
};

const manifest = { name: "targeted-test-fixture", version: "1.0.0", private: true, dependencies: { json5: "1.0.1" } };
const lockfile = {
  name: "targeted-test-fixture",
  version: "1.0.0",
  lockfileVersion: 3,
  requires: true,
  packages: {
    "": { name: "targeted-test-fixture", version: "1.0.0", dependencies: { json5: "1.0.1" } },
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
  nextLockfile.packages["node_modules/json5"] = { version: "1.0.2", integrity: "new", dependencies: { minimist: "^1.2.0" } };
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

function repairProposal(context: CompatibilityRepairContext) {
  return {
    model: "gpt-5.6" as const,
    source: "cached-demo" as const,
    proposal: {
      attempt: context.attempt,
      action: "apply_replacement" as const,
      classification: "planned_source_hardening" as const,
      explanation: "Copy only supported theme fields.",
      file: "src/theme.js" as const,
      oldText: context.source.functionText,
      newText: `function parseUserTheme(rawTheme) {
  const userTheme = JSON5.parse(rawTheme);

  return {
    accent: typeof userTheme.accent === "string" ? userTheme.accent : DEFAULT_THEME.accent,
    density: typeof userTheme.density === "string" ? userTheme.density : DEFAULT_THEME.density,
  };
}`,
      compatibilityRisks: ["Unknown fields will be dropped."],
      remainingUnknowns: ["Other callers may expect unknown fields."],
    },
  };
}

function targetedProposal(context: TargetedTestContext): TargetedTestProposalRun {
  return {
    model: "gpt-5.6",
    source: "cached-demo",
    proposal: {
      action: "add_test",
      classification: "mitigation_regression",
      explanation: "Verify the allowlist with a benign unsupported field.",
      file: "test/theme.test.js",
      insertion: "before_final_suite_close",
      testName: "does not copy unsupported theme fields",
      testText: `  it("does not copy unsupported theme fields", () => {
    const theme = parseUserTheme("{accent: '#ffb86c', density: 'compact', ${context.constraints.unsupportedField}: '${context.constraints.unsupportedValue}'}");

    assert.deepEqual(theme, { accent: "#ffb86c", density: "compact" });
    assert.equal(Object.hasOwn(theme, "previewLabel"), false);
  });`,
      safetyRationale: ["The test uses a benign application field."],
      remainingUnknowns: ["Other callers remain outside this focused test."],
    },
  };
}

async function createFixture() {
  const boundaryRoot = await mkdtemp(path.join(tmpdir(), "patchpilot-targeted-test-"));
  temporaryRoots.push(boundaryRoot);
  const sourceRoot = path.join(boundaryRoot, "source");
  await mkdir(path.join(sourceRoot, "src"), { recursive: true });
  await mkdir(path.join(sourceRoot, "test"), { recursive: true });
  await writeFile(path.join(sourceRoot, ".gitignore"), "node_modules/\n");
  await writeFile(path.join(sourceRoot, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(path.join(sourceRoot, "package-lock.json"), `${JSON.stringify(lockfile, null, 2)}\n`);
  await writeFile(path.join(sourceRoot, "src/theme.js"), originalSource);
  await writeFile(path.join(sourceRoot, "test/theme.test.js"), originalTest);
  await git(sourceRoot, ["init", "-b", "main"]);
  await git(sourceRoot, ["config", "user.email", "patchpilot@example.test"]);
  await git(sourceRoot, ["config", "user.name", "PatchPilot Test"]);
  await git(sourceRoot, ["add", "."]);
  await git(sourceRoot, ["commit", "-m", "targeted test baseline"]);

  const approvalStore = new RemediationApprovalStore();
  const pending = approvalStore.register(planRun);
  const proposal = approvalStore.decide({ planId: pending.id, decision: "approved" }, new Date("2026-07-18T10:00:00.000Z"));
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
  const compatibilityRepair = await runCompatibilityRepairLoop({
    proposal,
    isolationRun,
    dependencyUpdate,
    boundaryRoot,
    resultRoot: auditRoot,
    fixturePath: "unused-in-test.json",
    resolver: async (context) => repairProposal(context),
  });
  return { boundaryRoot, sourceRoot, auditRoot, proposal, isolationRun, dependencyUpdate, compatibilityRepair };
}

function commandResult(passed: boolean): TargetedTestCommandResult {
  return {
    command: "node --test test/theme.test.js",
    exitCode: passed ? 0 : 1,
    passed,
    durationMs: 12,
    stdout: passed ? "3 tests passed" : "1 test failed",
    stderr: "",
    outputTruncated: false,
  };
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("targeted regression-test generation", () => {
  it("inserts before a final suite close with or without an ending newline", () => {
    const testText = "  it(\"focused\", () => {});";
    expect(insertBeforeFinalSuiteClose("describe(\"suite\", () => {\n});", testText)).toBe(`describe("suite", () => {\n\n${testText}\n});`);
    expect(insertBeforeFinalSuiteClose("describe(\"suite\", () => {\n});\n", testText)).toBe(`describe("suite", () => {\n\n${testText}\n});\n`);
    expect(insertBeforeFinalSuiteClose("describe(\"suite\", () => {\n});\n\n", testText)).toBe(`describe("suite", () => {\n\n${testText}\n});\n\n`);
  });

  it("retains exactly one safe passing test in the isolated worktree", async () => {
    const fixture = await createFixture();
    let executions = 0;
    const result = await generateTargetedRegressionTest({
      ...fixture,
      resultRoot: fixture.auditRoot,
      fixturePath: "unused-in-test.json",
      resolver: async (context) => targetedProposal(context),
      testRunner: async (repositoryPath) => {
        executions += 1;
        expect(await readFile(path.join(repositoryPath, "test/theme.test.js"), "utf8")).toContain("previewLabel");
        return commandResult(true);
      },
      now: new Date("2026-07-18T10:10:00.000Z"),
    });

    expect(executions).toBe(1);
    expect(result.status).toBe("test_added_passed");
    expect(result.changedFiles).toEqual(["package-lock.json", "package.json", "src/theme.js", "test/theme.test.js"]);
    expect(result.testDiff).toContain("does not copy unsupported theme fields");
    expect(result.testDiff).not.toContain("__proto__");
    expect(await git(fixture.sourceRoot, ["status", "--porcelain=v1", "--untracked-files=all"])).toBe("");
    expect(await readFile(path.join(fixture.sourceRoot, "test/theme.test.js"), "utf8")).toBe(originalTest);
    expect(JSON.parse(await readFile(result.resultLogPath, "utf8"))).toEqual(result);
  });

  it("restores the original test file when the targeted command fails", async () => {
    const fixture = await createFixture();
    const result = await generateTargetedRegressionTest({
      ...fixture,
      resultRoot: fixture.auditRoot,
      fixturePath: "unused-in-test.json",
      resolver: async (context) => targetedProposal(context),
      testRunner: async () => commandResult(false),
    });

    expect(result.status).toBe("test_failed_restored");
    expect(result.testRestored).toBe(true);
    expect(result.testDiff).toBe("");
    expect(result.changedFiles).toEqual(["package-lock.json", "package.json", "src/theme.js"]);
    expect(await readFile(path.join(fixture.isolationRun.isolatedRepositoryPath, "test/theme.test.js"), "utf8")).toBe(originalTest);
  });
});
