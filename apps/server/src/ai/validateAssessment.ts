import {
  AffectednessAssessmentSchema,
  type AffectednessAssessment,
  type RepositoryEvidenceBundle,
} from "@patchpilot/contracts";

export function validateAffectednessAssessment(
  input: unknown,
  evidence: RepositoryEvidenceBundle,
): AffectednessAssessment {
  const assessment = AffectednessAssessmentSchema.parse(input);
  const itemsById = new Map(evidence.items.map((item) => [item.id, item]));
  const citedIds = [...assessment.supportingEvidenceIds, ...assessment.counterEvidenceIds];

  if (new Set(citedIds).size !== citedIds.length) {
    throw new Error("Assessment evidence citations must be unique and cannot appear on both sides");
  }
  for (const id of citedIds) {
    if (!itemsById.has(id)) throw new Error(`Assessment cites unknown evidence ID: ${id}`);
  }
  for (const id of assessment.supportingEvidenceIds) {
    if (itemsById.get(id)?.type === "absence") {
      throw new Error(`Absence evidence cannot support an affectedness claim: ${id}`);
    }
  }
  if (/\b(?:is|are|was|were|repository)\s+not affected\b/i.test(assessment.rationale)) {
    throw new Error("Assessment rationale makes an unsupported not-affected claim");
  }
  if (
    assessment.verdict === "no_relevant_usage_found"
    && evidence.items.some((item) => item.type === "call-site")
  ) {
    throw new Error("Assessment contradicts deterministic call-site evidence");
  }

  return assessment;
}
