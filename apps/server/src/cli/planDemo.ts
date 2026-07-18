import path from "node:path";
import { RemediationApprovalStore } from "../remediation/approvalGate.js";
import { createRemediationProposal } from "../remediation/createRemediationProposal.js";

const projectRoot = process.cwd();
const proposal = await createRemediationProposal({
  repositoryPath: path.join(projectRoot, "demo/vulnerable-node-app"),
  projectRoot,
  approvalStore: new RemediationApprovalStore(),
});

console.log(JSON.stringify(proposal, null, 2));
