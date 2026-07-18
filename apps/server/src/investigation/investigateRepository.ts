import path from "node:path";
import { InvestigationResultSchema, type InvestigationResult } from "@patchpilot/contracts";
import { loadCachedAdvisory } from "../advisory/resolveAdvisory.js";
import { createAffectednessContext } from "../ai/affectednessContext.js";
import { resolveAffectednessAssessment } from "../ai/assessAffectedness.js";
import { collectRepositoryEvidence } from "../repository/collectEvidence.js";
import { scanRepository } from "../scanning/osvScanner.js";

const expectedId = "GHSA-9c47-m6qq-7p4h";

export async function investigateRepository(options: {
  repositoryPath: string;
  projectRoot: string;
}): Promise<InvestigationResult> {
  const scan = await scanRepository({ repositoryPath: options.repositoryPath });
  const finding = scan.findings.find(({ id }) => id === expectedId);
  if (!finding) throw new Error(`Investigation stopped: ${expectedId} was not detected`);

  const advisory = await loadCachedAdvisory(expectedId, path.join(options.projectRoot, "demo/cached-advisories"));
  const evidence = await collectRepositoryEvidence({ repositoryPath: options.repositoryPath, finding, advisory });
  const context = await createAffectednessContext({ repositoryPath: options.repositoryPath, finding, advisory, evidence });
  const assessmentRun = await resolveAffectednessAssessment({
    context,
    evidence,
    fixturePath: path.join(options.projectRoot, "demo/expected/affectedness-assessment.json"),
  });

  return InvestigationResultSchema.parse({ finding, advisory, evidence, assessmentRun });
}
