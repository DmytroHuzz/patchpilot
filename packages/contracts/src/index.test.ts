import { describe, expect, it } from "vitest";
import {
  AffectednessAssessmentSchema,
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
});
