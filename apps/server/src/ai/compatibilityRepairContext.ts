import type {
  DependencyUpdateResult,
  RemediationProposal,
} from "@patchpilot/contracts";

export interface RelevantSyntaxFailure {
  command: "node --check src/theme.js";
  exitCode: number;
  stderr: string;
}

export interface CompatibilityRepairContext {
  attempt: 1 | 2;
  approvedPlan: {
    targetVersion: string;
    strategy: "dependency_upgrade_and_code_change";
    explanation: string;
    expectedSourceFile: "src/theme.js";
    compatibilityRisks: string[];
  };
  dependencyUpdate: {
    packageName: "json5";
    fromVersion: string;
    targetVersion: string;
    changedFiles: ["package-lock.json", "package.json"];
    unrelatedDependenciesChanged: false;
  };
  source: {
    file: "src/theme.js";
    functionName: "parseUserTheme";
    functionText: string;
  };
  previousSyntaxFailure: RelevantSyntaxFailure | null;
  constraints: {
    allowedFile: "src/theme.js";
    allowedOperation: "replace_exact_function";
    maxAttempts: 2;
    noTestChanges: true;
  };
}

export function extractParseUserTheme(sourceContent: string): string {
  if (sourceContent.length > 32 * 1024) throw new Error("Source file exceeds the 32 KiB repair boundary");
  const signature = "function parseUserTheme(rawTheme)";
  const start = sourceContent.indexOf(signature);
  if (start < 0 || sourceContent.indexOf(signature, start + signature.length) >= 0) {
    throw new Error("Expected exactly one parseUserTheme function");
  }
  const openingBrace = sourceContent.indexOf("{", start + signature.length);
  if (openingBrace < 0) throw new Error("parseUserTheme has no function body");
  let depth = 0;
  for (let index = openingBrace; index < sourceContent.length; index += 1) {
    if (sourceContent[index] === "{") depth += 1;
    if (sourceContent[index] === "}") {
      depth -= 1;
      if (depth === 0) return sourceContent.slice(start, index + 1);
    }
  }
  throw new Error("parseUserTheme function body is incomplete");
}

export function createCompatibilityRepairContext(options: {
  proposal: RemediationProposal;
  dependencyUpdate: DependencyUpdateResult;
  sourceContent: string;
  attempt: 1 | 2;
  previousSyntaxFailure?: RelevantSyntaxFailure | null;
}): CompatibilityRepairContext {
  const plan = options.proposal.planRun.plan;
  if (plan.strategy !== "dependency_upgrade_and_code_change" || !plan.expectedFiles.includes("src/theme.js")) {
    throw new Error("Approved plan does not permit a compatibility source repair");
  }
  return {
    attempt: options.attempt,
    approvedPlan: {
      targetVersion: plan.targetVersion,
      strategy: plan.strategy,
      explanation: plan.explanation,
      expectedSourceFile: "src/theme.js",
      compatibilityRisks: plan.expectedCompatibilityRisks,
    },
    dependencyUpdate: {
      packageName: options.dependencyUpdate.packageName,
      fromVersion: options.dependencyUpdate.fromVersion,
      targetVersion: options.dependencyUpdate.targetVersion,
      changedFiles: options.dependencyUpdate.changedFiles,
      unrelatedDependenciesChanged: options.dependencyUpdate.unrelatedDependenciesChanged,
    },
    source: {
      file: "src/theme.js",
      functionName: "parseUserTheme",
      functionText: extractParseUserTheme(options.sourceContent),
    },
    previousSyntaxFailure: options.previousSyntaxFailure ?? null,
    constraints: {
      allowedFile: "src/theme.js",
      allowedOperation: "replace_exact_function",
      maxAttempts: 2,
      noTestChanges: true,
    },
  };
}
