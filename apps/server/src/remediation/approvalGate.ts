import { createHash } from "node:crypto";
import {
  RemediationDecisionRequestSchema,
  RemediationPlanRunSchema,
  RemediationProposalSchema,
  type ApprovalRecord,
  type RemediationDecisionRequest,
  type RemediationPlan,
  type RemediationPlanRun,
  type RemediationProposal,
} from "@patchpilot/contracts";

export function remediationPlanId(plan: RemediationPlan): string {
  return `plan-${createHash("sha256").update(JSON.stringify(plan)).digest("hex")}`;
}

export class RemediationApprovalStore {
  readonly #proposals = new Map<string, RemediationProposal>();

  register(planRun: RemediationPlanRun): RemediationProposal {
    const validatedRun = RemediationPlanRunSchema.parse(planRun);
    const id = remediationPlanId(validatedRun.plan);
    const existing = this.#proposals.get(id);
    if (existing) return existing;

    const proposal = RemediationProposalSchema.parse({
      id,
      planRun: validatedRun,
      status: "awaiting_approval",
    });
    this.#proposals.set(id, proposal);
    return proposal;
  }

  decide(request: RemediationDecisionRequest, now = new Date()): RemediationProposal {
    const decision = RemediationDecisionRequestSchema.parse(request);
    const proposal = this.#proposals.get(decision.planId);
    if (!proposal) throw new Error("Remediation proposal is unknown or expired");
    if (proposal.status !== "awaiting_approval") throw new Error("Remediation proposal already has a recorded decision");

    const approval: ApprovalRecord = {
      planId: proposal.id,
      decision: decision.decision,
      recordedAt: now.toISOString(),
    };
    const decided = RemediationProposalSchema.parse({
      ...proposal,
      status: decision.decision,
      approval,
    });
    this.#proposals.set(decided.id, decided);
    return decided;
  }

  get(planId: string): RemediationProposal | undefined {
    return this.#proposals.get(planId);
  }
}

export function assertRemediationApproved(proposal: RemediationProposal): ApprovalRecord {
  const validated = RemediationProposalSchema.parse(proposal);
  const expectedId = remediationPlanId(validated.planRun.plan);
  if (validated.id !== expectedId) throw new Error("Approval gate rejected a plan whose content no longer matches its ID");
  if (validated.status !== "approved" || validated.approval?.decision !== "approved") {
    throw new Error("Explicit approval for this exact remediation plan is required before repository writes");
  }
  return validated.approval;
}
