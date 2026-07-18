import type { CompatibilityRepairProposal } from "@patchpilot/contracts";
import { extractParseUserTheme, type CompatibilityRepairContext } from "./compatibilityRepairContext.js";

export function validateCompatibilityRepair(
  proposal: CompatibilityRepairProposal,
  context: CompatibilityRepairContext,
): CompatibilityRepairProposal {
  if (proposal.attempt !== context.attempt) throw new Error("Repair proposal attempt does not match the bounded context");
  if (proposal.action !== "apply_replacement") return proposal;
  if (proposal.file !== context.constraints.allowedFile) throw new Error("Repair proposal uses a disallowed file");
  if (proposal.oldText !== context.source.functionText) throw new Error("Repair proposal oldText does not match the exact supplied function");
  if (!proposal.newText) throw new Error("Repair proposal has no replacement text");
  if (!proposal.newText.startsWith("function parseUserTheme(rawTheme)")) throw new Error("Repair replacement must preserve the function signature");
  if (extractParseUserTheme(proposal.newText) !== proposal.newText) throw new Error("Repair replacement must contain only the exact function");
  for (const required of ["JSON5.parse(rawTheme)", "DEFAULT_THEME", "accent", "density"]) {
    if (!proposal.newText.includes(required)) throw new Error(`Repair replacement must preserve ${required}`);
  }
  if (/\.\.\.\s*userTheme|Object\.assign\s*\([^)]*userTheme/.test(proposal.newText)) {
    throw new Error("Repair replacement must not copy the complete parsed object");
  }
  if (/\b(?:require|import|eval|Function|process|child_process|fetch)\b/.test(proposal.newText)) {
    throw new Error("Repair replacement contains a disallowed capability");
  }
  return proposal;
}
