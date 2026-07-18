import path from "node:path";
import type { RemediationProposal } from "@patchpilot/contracts";
import { createRemediationContext } from "../ai/remediationContext.js";
import { resolveRemediationPlan } from "../ai/planRemediation.js";
import { investigateRepository } from "../investigation/investigateRepository.js";
import type { RemediationApprovalStore } from "./approvalGate.js";

export async function createRemediationProposal(options: {
  repositoryPath: string;
  projectRoot: string;
  approvalStore: RemediationApprovalStore;
}): Promise<RemediationProposal> {
  const investigation = await investigateRepository({
    repositoryPath: options.repositoryPath,
    projectRoot: options.projectRoot,
  });
  const context = await createRemediationContext({
    repositoryPath: options.repositoryPath,
    finding: investigation.finding,
    assessment: investigation.assessmentRun.assessment,
    evidence: investigation.evidence.items,
    searchedFiles: investigation.evidence.searchedFiles,
  });
  const planRun = await resolveRemediationPlan({
    context,
    fixturePath: path.join(options.projectRoot, "demo/expected/remediation-plan.json"),
  });
  return options.approvalStore.register(planRun);
}
