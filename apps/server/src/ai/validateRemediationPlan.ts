import { RemediationPlanSchema, type RemediationPlan } from "@patchpilot/contracts";
import type { RemediationContext } from "./remediationContext.js";

function isSafeRelativePath(file: string): boolean {
  return !file.startsWith("/") && !file.split(/[\\/]/).includes("..") && !file.includes("\\");
}

export function validateRemediationPlan(input: unknown, context: RemediationContext): RemediationPlan {
  const plan = RemediationPlanSchema.parse(input);
  if (!context.finding.fixedVersions.includes(plan.targetVersion)) {
    throw new Error(`Remediation target is not a supplied fixed version: ${plan.targetVersion}`);
  }
  if (new Set(plan.expectedFiles).size !== plan.expectedFiles.length) {
    throw new Error("Remediation expected files must be unique");
  }
  for (const file of plan.expectedFiles) {
    if (!isSafeRelativePath(file) || !context.allowedFiles.includes(file)) {
      throw new Error(`Remediation plan contains a disallowed file: ${file}`);
    }
  }
  for (const command of plan.proposedCommands) {
    if (!context.allowedCommands.includes(command)) {
      throw new Error(`Remediation plan contains a disallowed command: ${command}`);
    }
  }
  const sourceFiles = context.relevantSourceExcerpts.flatMap((item) => item.file ? [item.file] : []);
  if (plan.strategy === "dependency_upgrade_and_code_change" && !plan.expectedFiles.some((file) => sourceFiles.includes(file))) {
    throw new Error("Combined remediation must name an evidence-backed source file");
  }
  if (!plan.expectedFiles.includes(context.finding.manifestPath)) {
    throw new Error("Dependency remediation must include the package manifest");
  }
  if (!plan.proposedCommands.some((command) => command.startsWith("npm install "))) {
    throw new Error("Dependency remediation must include the allowlisted install command");
  }
  return plan;
}
