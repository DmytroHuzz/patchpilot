import { describe, expect, it } from "vitest";
import {
  AffectednessAssessmentSchema,
  CompatibilityRepairProposalSchema,
  CompatibilityRepairResultSchema,
  DependencyUpdateResultSchema,
  IsolationRunSchema,
  NormalizedScanResultSchema,
  RemediationPlanSchema,
  productName,
} from "./index.js";

describe("contracts package", () => {
  it("exports the product identity", () => {
    expect(productName).toBe("PatchPilot");
  });

  it("rejects incomplete normalized scan results", () => {
    expect(() => NormalizedScanResultSchema.parse({ scanner: "osv-scanner" })).toThrow();
  });

  it("rejects non-enumerated verdicts and incomplete uncertainty", () => {
    const assessment = {
      verdict: "not_affected",
      confidence: "high",
      rationale: "Unsupported conclusion",
      supportingEvidenceIds: [],
      counterEvidenceIds: [],
      unknowns: [],
      limitations: [],
      recommendedNextChecks: ["Review input handling"],
    };

    expect(() => AffectednessAssessmentSchema.parse(assessment)).toThrow();
  });

  it("requires human approval in every remediation plan", () => {
    expect(() => RemediationPlanSchema.parse({
      targetVersion: "1.0.2",
      strategy: "dependency_upgrade",
      explanation: "Upgrade to the fixed release.",
      expectedFiles: ["package.json"],
      expectedCompatibilityRisks: ["Dependency behavior may change."],
      proposedCommands: ["npm install json5@1.0.2 --save-exact"],
      proposedTests: ["npm test"],
      requiresHumanApproval: false,
    })).toThrow();
  });

  it("rejects isolation metadata whose approval references another plan", () => {
    const planId = `plan-${"a".repeat(64)}`;
    const events = [
      "approval_validated",
      "paths_validated",
      "clean_tree_validated",
      "baseline_captured",
      "worktree_created",
      "workspace_ready",
    ].map((action, index) => ({
      sequence: index + 1,
      at: "2026-07-18T10:00:00.000Z",
      action,
      detail: action,
    }));

    expect(() => IsolationRunSchema.parse({
      id: "run-00000000-0000-4000-8000-000000000000",
      planId,
      status: "ready",
      sourceRepositoryPath: "/safe/source/demo",
      sourceGitRoot: "/safe/source",
      sourceBranch: "main",
      baselineCommit: "b".repeat(40),
      branchName: "patchpilot/run-00000000-0000-4000-8000-000000000000",
      worktreePath: "/safe/runs/worktrees/run",
      isolatedRepositoryPath: "/safe/runs/worktrees/run/demo",
      auditLogPath: "/safe/runs/audit/run.json",
      sourceTreeClean: true,
      createdAt: "2026-07-18T10:00:00.000Z",
      approval: {
        planId: `plan-${"c".repeat(64)}`,
        decision: "approved",
        recordedAt: "2026-07-18T09:59:00.000Z",
      },
      events,
    })).toThrow("approved plan");
  });

  it("rejects dependency updates that do not reach the approved version in both files", () => {
    expect(() => DependencyUpdateResultSchema.parse({
      runId: "run-00000000-0000-4000-8000-000000000009",
      planId: `plan-${"a".repeat(64)}`,
      status: "dependency_updated",
      packageName: "json5",
      fromVersion: "1.0.1",
      targetVersion: "1.0.2",
      manifestVersion: "1.0.2",
      lockfileVersion: "1.0.1",
      changedFiles: ["package-lock.json", "package.json"],
      unrelatedDependenciesChanged: false,
      sourceCheckoutClean: true,
      commandResult: {
        command: "npm install json5@1.0.2 --save-exact",
        exitCode: 0,
        durationMs: 10,
        stdout: "updated",
        stderr: "",
        outputTruncated: false,
      },
      diff: "diff --git a/package.json b/package.json",
      resultLogPath: "/safe/runs/audit/dependency.json",
      completedAt: "2026-07-18T10:30:00.000Z",
    })).toThrow("approved target");
  });

  it("rejects exhausted repairs that retain a source-file change", () => {
    const failedAttempt = (attempt: 1 | 2) => ({
      attempt,
      proposalRun: {
        model: "gpt-5.6" as const,
        source: "cached-demo" as const,
        proposal: {
          attempt,
          action: "apply_replacement" as const,
          classification: "upgrade_compatibility_failure" as const,
          file: "src/theme.js" as const,
          oldText: "function parseUserTheme(rawTheme) { return rawTheme; }",
          newText: "function parseUserTheme(rawTheme) { return JSON5.parse(rawTheme); }",
          explanation: "The bounded parser replacement addresses the approved compatibility risk.",
          compatibilityRisks: ["The retry may still fail syntax validation."],
          remainingUnknowns: ["Full regression behavior has not yet been tested."],
        },
      },
      status: "applied_failed" as const,
      probe: {
        command: "node --check src/theme.js" as const,
        exitCode: 1,
        passed: false,
        durationMs: 1,
        stdout: "",
        stderr: "SyntaxError: Unexpected token",
      },
    });

    expect(() => CompatibilityRepairResultSchema.parse({
      runId: "run-00000000-0000-4000-8000-000000000009",
      planId: `plan-${"a".repeat(64)}`,
      status: "failed_after_two_attempts",
      file: "src/theme.js",
      attempts: [failedAttempt(1), failedAttempt(2)],
      changedFiles: ["package-lock.json", "package.json", "src/theme.js"],
      sourceCheckoutClean: true,
      sourceRestored: true,
      sourceDiff: "",
      resultLogPath: "/safe/runs/audit/repair.json",
      completedAt: "2026-07-18T10:30:00.000Z",
    })).toThrow("dependency update");
  });

  it("requires explicit repair stops to match their failure classification", () => {
    expect(() => CompatibilityRepairProposalSchema.parse({
      attempt: 1,
      action: "stop_unrelated",
      classification: "insufficient_evidence",
      explanation: "Stop without a source edit.",
      file: null,
      oldText: null,
      newText: null,
      compatibilityRisks: ["The failure remains unresolved."],
      remainingUnknowns: ["The root cause is outside the bounded context."],
    })).toThrow("unrelated-failure");
  });
});
