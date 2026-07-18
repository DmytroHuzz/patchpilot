import type { TargetedTestProposal } from "@patchpilot/contracts";
import type { TargetedTestContext } from "./targetedTestContext.js";

export function validateTargetedTest(
  proposal: TargetedTestProposal,
  context: TargetedTestContext,
): TargetedTestProposal {
  if (proposal.action !== "add_test") return proposal;
  if (proposal.file !== context.constraints.allowedFile) throw new Error("Targeted test proposal uses a disallowed file");
  if (proposal.insertion !== context.constraints.allowedInsertion) throw new Error("Targeted test proposal uses a disallowed insertion point");
  if (!proposal.testName || !proposal.testText) throw new Error("Targeted test proposal is incomplete");
  if (!proposal.testText.startsWith(`  it("${proposal.testName}"`)) throw new Error("Targeted test text must match its declared name");
  if (!proposal.testText.endsWith("  });")) throw new Error("Targeted test must be one complete it block");
  if ((proposal.testText.match(/\bit\s*\(/g) ?? []).length !== 1) throw new Error("Targeted proposal must contain exactly one test");
  for (const required of [
    "parseUserTheme",
    "previewLabel",
    "ignored",
    "assert.deepEqual",
    "Object.hasOwn",
    "accent",
    "density",
  ]) {
    if (!proposal.testText.includes(required)) throw new Error(`Targeted test must include ${required}`);
  }
  if (/\b(?:__proto__|constructor|prototype|setPrototypeOf|defineProperty|eval|Function|process|child_process|fetch|require|import)\b|https?:\/\/|assert\.throws/.test(proposal.testText)) {
    throw new Error("Targeted test contains a weaponized or disallowed capability");
  }
  return proposal;
}
