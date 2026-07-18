import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { RemediationPlanRun } from "@patchpilot/contracts";
import { assertRemediationApproved, RemediationApprovalStore } from "./approvalGate.js";

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

describe("RemediationApprovalStore", () => {
  it("fails closed before an explicit approval", () => {
    const proposal = new RemediationApprovalStore().register(planRun);

    expect(() => assertRemediationApproved(proposal)).toThrow("Explicit approval");
  });

  it("records approval for the exact plan and opens the gate", () => {
    const store = new RemediationApprovalStore();
    const proposal = store.register(planRun);
    const approved = store.decide(
      { planId: proposal.id, decision: "approved" },
      new Date("2026-07-18T09:00:00.000Z"),
    );

    expect(assertRemediationApproved(approved)).toEqual({
      planId: proposal.id,
      decision: "approved",
      recordedAt: "2026-07-18T09:00:00.000Z",
    });
  });

  it("keeps cancellation closed and leaves the golden repository unchanged", async () => {
    const repositoryPath = path.resolve(import.meta.dirname, "../../../../demo/vulnerable-node-app");
    const files = ["package.json", "package-lock.json", "src/theme.js", "test/theme.test.js"];
    const before = await Promise.all(files.map((file) => readFile(path.join(repositoryPath, file), "utf8")));
    const store = new RemediationApprovalStore();
    const proposal = store.register(planRun);
    const cancelled = store.decide({ planId: proposal.id, decision: "cancelled" });
    const after = await Promise.all(files.map((file) => readFile(path.join(repositoryPath, file), "utf8")));

    expect(() => assertRemediationApproved(cancelled)).toThrow("Explicit approval");
    expect(after).toEqual(before);
  });

  it("rejects an approved proposal if its plan content is tampered", () => {
    const store = new RemediationApprovalStore();
    const proposal = store.register(planRun);
    const approved = store.decide({ planId: proposal.id, decision: "approved" });
    const tampered = {
      ...approved,
      planRun: {
        ...approved.planRun,
        plan: { ...approved.planRun.plan, targetVersion: "9.9.9" },
      },
    };

    expect(() => assertRemediationApproved(tampered)).toThrow("no longer matches its ID");
  });

  it("does not allow a decision to be overwritten", () => {
    const store = new RemediationApprovalStore();
    const proposal = store.register(planRun);
    store.decide({ planId: proposal.id, decision: "cancelled" });

    expect(() => store.decide({ planId: proposal.id, decision: "approved" })).toThrow("already has a recorded decision");
  });
});
