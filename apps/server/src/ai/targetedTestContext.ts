import type {
  CompatibilityRepairResult,
  DependencyUpdateResult,
  RemediationProposal,
} from "@patchpilot/contracts";
import { extractParseUserTheme } from "./compatibilityRepairContext.js";

export interface TargetedTestContext {
  approvedPlan: {
    strategy: "dependency_upgrade_and_code_change";
    expectedTestFile: "test/theme.test.js";
    verificationIntent: string;
  };
  dependencyUpdate: {
    packageName: "json5";
    fromVersion: string;
    targetVersion: string;
  };
  compatibilityRepair: {
    status: "repaired";
    file: "src/theme.js";
    syntaxPassed: true;
  };
  source: {
    file: "src/theme.js";
    functionName: "parseUserTheme";
    functionText: string;
  };
  existingTests: {
    file: "test/theme.test.js";
    text: string;
  };
  constraints: {
    allowedFile: "test/theme.test.js";
    allowedInsertion: "before_final_suite_close";
    unsupportedField: "previewLabel";
    unsupportedValue: "ignored";
    supportedFields: ["accent", "density"];
    noPrototypeKeys: true;
    noNewImportsDependenciesOrCommands: true;
    exactlyOneTest: true;
  };
}

export function createTargetedTestContext(options: {
  proposal: RemediationProposal;
  dependencyUpdate: DependencyUpdateResult;
  compatibilityRepair: CompatibilityRepairResult;
  sourceContent: string;
  testContent: string;
}): TargetedTestContext {
  const plan = options.proposal.planRun.plan;
  if (plan.strategy !== "dependency_upgrade_and_code_change" || !plan.expectedFiles.includes("test/theme.test.js")) {
    throw new Error("Approved plan does not permit a targeted regression test");
  }
  if (options.compatibilityRepair.status !== "repaired" || options.compatibilityRepair.attempts.at(-1)?.probe?.passed !== true) {
    throw new Error("Targeted test generation requires a passing compatibility repair");
  }
  if (options.testContent.length > 32 * 1024) throw new Error("Test file exceeds the 32 KiB generation boundary");
  const verificationIntent = plan.proposedTests.find((test) => /targeted|unsupported input keys/i.test(test));
  if (!verificationIntent) throw new Error("Approved plan has no targeted regression-test intent");

  return {
    approvedPlan: {
      strategy: plan.strategy,
      expectedTestFile: "test/theme.test.js",
      verificationIntent,
    },
    dependencyUpdate: {
      packageName: options.dependencyUpdate.packageName,
      fromVersion: options.dependencyUpdate.fromVersion,
      targetVersion: options.dependencyUpdate.targetVersion,
    },
    compatibilityRepair: {
      status: options.compatibilityRepair.status,
      file: options.compatibilityRepair.file,
      syntaxPassed: true,
    },
    source: {
      file: "src/theme.js",
      functionName: "parseUserTheme",
      functionText: extractParseUserTheme(options.sourceContent),
    },
    existingTests: {
      file: "test/theme.test.js",
      text: options.testContent,
    },
    constraints: {
      allowedFile: "test/theme.test.js",
      allowedInsertion: "before_final_suite_close",
      unsupportedField: "previewLabel",
      unsupportedValue: "ignored",
      supportedFields: ["accent", "density"],
      noPrototypeKeys: true,
      noNewImportsDependenciesOrCommands: true,
      exactlyOneTest: true,
    },
  };
}
