import { z } from "zod";

export const productName = "PatchPilot";

export const VulnerabilityFindingSchema = z.object({
  id: z.string().min(1),
  aliases: z.array(z.string()),
  packageName: z.string().min(1),
  ecosystem: z.literal("npm"),
  installedVersion: z.string().min(1),
  manifestPath: z.string().min(1),
  lockfilePath: z.string().min(1).optional(),
  direct: z.boolean(),
  dependencyPath: z.array(z.string()),
  severity: z.string().min(1).optional(),
  summary: z.string().min(1),
  details: z.string(),
  affectedRanges: z.array(z.string()),
  fixedVersions: z.array(z.string()),
  affectedFunctions: z.array(z.string()),
  references: z.array(z.string().url()),
  source: z.enum(["osv", "dependabot", "cached-demo"]),
});

export type VulnerabilityFinding = z.infer<typeof VulnerabilityFindingSchema>;

export const NormalizedAdvisorySchema = z.object({
  id: z.string().min(1),
  aliases: z.array(z.string()),
  summary: z.string().min(1),
  details: z.string().min(1),
  severity: z.string().min(1).optional(),
  affectedRanges: z.array(z.string()),
  fixedVersions: z.array(z.string()),
  affectedFunctions: z.array(z.string()),
  references: z.array(z.string().url()),
  source: z.enum(["osv", "cached-demo"]),
});

export type NormalizedAdvisory = z.infer<typeof NormalizedAdvisorySchema>;

export const EvidenceItemSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["import", "call-site", "configuration", "data-flow", "absence", "advisory"]),
  file: z.string().min(1).optional(),
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
  excerpt: z.string().min(1).optional(),
  explanation: z.string().min(1),
  deterministic: z.boolean(),
}).superRefine((item, context) => {
  const positioned = item.file !== undefined || item.startLine !== undefined || item.endLine !== undefined || item.excerpt !== undefined;
  if (positioned && (item.file === undefined || item.startLine === undefined || item.endLine === undefined || item.excerpt === undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Positioned evidence requires file, lines, and excerpt" });
  }
  if (item.startLine !== undefined && item.endLine !== undefined && item.endLine < item.startLine) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Evidence endLine must not precede startLine" });
  }
});

export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

export const RepositoryEvidenceBundleSchema = z.object({
  repositoryPath: z.string().min(1),
  findingId: z.string().min(1),
  searchedFiles: z.array(z.string()),
  searchedBytes: z.number().int().nonnegative(),
  truncated: z.boolean(),
  items: z.array(EvidenceItemSchema),
});

export type RepositoryEvidenceBundle = z.infer<typeof RepositoryEvidenceBundleSchema>;

export const AffectednessAssessmentSchema = z.object({
  verdict: z.enum([
    "likely_affected",
    "possibly_affected",
    "no_relevant_usage_found",
    "insufficient_evidence",
  ]),
  confidence: z.enum(["low", "medium", "high"]),
  rationale: z.string().min(1),
  supportingEvidenceIds: z.array(z.string().min(1)).max(24),
  counterEvidenceIds: z.array(z.string().min(1)).max(24),
  unknowns: z.array(z.string().min(1)).min(1).max(12),
  limitations: z.array(z.string().min(1)).min(1).max(12),
  recommendedNextChecks: z.array(z.string().min(1)).min(1).max(12),
}).strict();

export type AffectednessAssessment = z.infer<typeof AffectednessAssessmentSchema>;

export const AssessmentRunSchema = z.object({
  model: z.literal("gpt-5.6"),
  source: z.enum(["openai", "cached-demo"]),
  assessment: AffectednessAssessmentSchema,
}).strict();

export type AssessmentRun = z.infer<typeof AssessmentRunSchema>;

export const RemediationPlanSchema = z.object({
  targetVersion: z.string().min(1),
  strategy: z.enum([
    "dependency_upgrade",
    "dependency_upgrade_and_code_change",
    "configuration_mitigation",
  ]),
  explanation: z.string().min(1),
  expectedFiles: z.array(z.string().min(1)).min(1).max(12),
  expectedCompatibilityRisks: z.array(z.string().min(1)).min(1).max(12),
  proposedCommands: z.array(z.string().min(1)).min(1).max(12),
  proposedTests: z.array(z.string().min(1)).min(1).max(12),
  requiresHumanApproval: z.literal(true),
}).strict();

export type RemediationPlan = z.infer<typeof RemediationPlanSchema>;

export const RemediationPlanRunSchema = z.object({
  model: z.literal("gpt-5.6"),
  source: z.enum(["openai", "cached-demo"]),
  plan: RemediationPlanSchema,
}).strict();

export type RemediationPlanRun = z.infer<typeof RemediationPlanRunSchema>;

export const ApprovalRecordSchema = z.object({
  planId: z.string().regex(/^plan-[a-f0-9]{64}$/),
  decision: z.enum(["approved", "cancelled"]),
  recordedAt: z.string().datetime(),
}).strict();

export type ApprovalRecord = z.infer<typeof ApprovalRecordSchema>;

export const RemediationProposalSchema = z.object({
  id: z.string().regex(/^plan-[a-f0-9]{64}$/),
  planRun: RemediationPlanRunSchema,
  status: z.enum(["awaiting_approval", "approved", "cancelled"]),
  approval: ApprovalRecordSchema.optional(),
}).strict().superRefine((proposal, context) => {
  if (proposal.status === "awaiting_approval" && proposal.approval !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Awaiting proposals cannot have an approval record" });
  }
  if (proposal.status !== "awaiting_approval" && proposal.approval === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Decided proposals require an approval record" });
  }
  if (proposal.approval && proposal.approval.decision !== proposal.status) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Approval decision must match proposal status" });
  }
  if (proposal.approval && proposal.approval.planId !== proposal.id) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Approval record must reference the proposal" });
  }
});

export type RemediationProposal = z.infer<typeof RemediationProposalSchema>;

export const RemediationDecisionRequestSchema = z.object({
  planId: z.string().regex(/^plan-[a-f0-9]{64}$/),
  decision: z.enum(["approved", "cancelled"]),
}).strict();

export type RemediationDecisionRequest = z.infer<typeof RemediationDecisionRequestSchema>;

export const IsolationAuditEventSchema = z.object({
  sequence: z.number().int().positive(),
  at: z.string().datetime(),
  action: z.enum([
    "approval_validated",
    "paths_validated",
    "clean_tree_validated",
    "baseline_captured",
    "worktree_created",
    "workspace_ready",
  ]),
  detail: z.string().min(1),
}).strict();

export type IsolationAuditEvent = z.infer<typeof IsolationAuditEventSchema>;

export const IsolationRunSchema = z.object({
  id: z.string().regex(/^run-[0-9a-f-]{36}$/),
  planId: z.string().regex(/^plan-[a-f0-9]{64}$/),
  status: z.literal("ready"),
  sourceRepositoryPath: z.string().min(1),
  sourceGitRoot: z.string().min(1),
  sourceBranch: z.string().min(1),
  baselineCommit: z.string().regex(/^[a-f0-9]{40,64}$/),
  branchName: z.string().regex(/^patchpilot\/run-[0-9a-f-]{36}$/),
  worktreePath: z.string().min(1),
  isolatedRepositoryPath: z.string().min(1),
  auditLogPath: z.string().min(1),
  sourceTreeClean: z.literal(true),
  createdAt: z.string().datetime(),
  approval: ApprovalRecordSchema,
  events: z.array(IsolationAuditEventSchema).min(6).max(12),
}).strict().superRefine((run, context) => {
  if (run.planId !== run.approval.planId) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Isolation run must reference its approved plan" });
  }
  const expectedActions = [
    "approval_validated",
    "paths_validated",
    "clean_tree_validated",
    "baseline_captured",
    "worktree_created",
    "workspace_ready",
  ];
  if (run.events.some((event, index) => event.sequence !== index + 1 || event.action !== expectedActions[index])) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Isolation audit events must be complete and ordered" });
  }
});

export type IsolationRun = z.infer<typeof IsolationRunSchema>;

export const IsolationRequestSchema = z.object({
  planId: z.string().regex(/^plan-[a-f0-9]{64}$/),
}).strict();

export type IsolationRequest = z.infer<typeof IsolationRequestSchema>;

export const DependencyCommandResultSchema = z.object({
  command: z.string().min(1),
  exitCode: z.literal(0),
  durationMs: z.number().int().nonnegative(),
  stdout: z.string().max(32 * 1024),
  stderr: z.string().max(32 * 1024),
  outputTruncated: z.boolean(),
}).strict();

export type DependencyCommandResult = z.infer<typeof DependencyCommandResultSchema>;

export const DependencyUpdateResultSchema = z.object({
  runId: z.string().regex(/^run-[0-9a-f-]{36}$/),
  planId: z.string().regex(/^plan-[a-f0-9]{64}$/),
  status: z.literal("dependency_updated"),
  packageName: z.literal("json5"),
  fromVersion: z.string().min(1),
  targetVersion: z.string().min(1),
  manifestVersion: z.string().min(1),
  lockfileVersion: z.string().min(1),
  changedFiles: z.tuple([z.literal("package-lock.json"), z.literal("package.json")]),
  unrelatedDependenciesChanged: z.literal(false),
  sourceCheckoutClean: z.literal(true),
  commandResult: DependencyCommandResultSchema,
  diff: z.string().min(1).max(64 * 1024),
  resultLogPath: z.string().min(1),
  completedAt: z.string().datetime(),
}).strict().superRefine((result, context) => {
  if (result.planId.length === 0 || result.runId.length === 0) return;
  if (result.manifestVersion !== result.targetVersion || result.lockfileVersion !== result.targetVersion) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Manifest and lockfile must match the approved target" });
  }
});

export type DependencyUpdateResult = z.infer<typeof DependencyUpdateResultSchema>;

export const DependencyUpdateRequestSchema = z.object({
  planId: z.string().regex(/^plan-[a-f0-9]{64}$/),
  runId: z.string().regex(/^run-[0-9a-f-]{36}$/),
}).strict();

export type DependencyUpdateRequest = z.infer<typeof DependencyUpdateRequestSchema>;

export const CompatibilityRepairProposalSchema = z.object({
  attempt: z.union([z.literal(1), z.literal(2)]),
  action: z.enum(["apply_replacement", "stop_unrelated", "stop_insufficient_evidence"]),
  classification: z.enum(["planned_source_hardening", "upgrade_compatibility_failure", "unrelated_failure", "insufficient_evidence"]),
  explanation: z.string().min(1).max(2000),
  file: z.literal("src/theme.js").nullable(),
  oldText: z.string().min(1).max(4096).nullable(),
  newText: z.string().min(1).max(4096).nullable(),
  compatibilityRisks: z.array(z.string().min(1)).min(1).max(6),
  remainingUnknowns: z.array(z.string().min(1)).min(1).max(6),
}).strict().superRefine((proposal, context) => {
  if (proposal.action === "apply_replacement") {
    if (proposal.file === null || proposal.oldText === null || proposal.newText === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Applied repairs require file, oldText, and newText" });
    }
    if (!(["planned_source_hardening", "upgrade_compatibility_failure"] as const).includes(
      proposal.classification as "planned_source_hardening" | "upgrade_compatibility_failure",
    )) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Applied repair classification is invalid" });
    }
  } else if (proposal.file !== null || proposal.oldText !== null || proposal.newText !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Stopped repairs cannot include an edit" });
  }
  if (proposal.action === "stop_unrelated" && proposal.classification !== "unrelated_failure") {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Unrelated stops require an unrelated-failure classification" });
  }
  if (proposal.action === "stop_insufficient_evidence" && proposal.classification !== "insufficient_evidence") {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Insufficient-evidence stops require the matching classification" });
  }
});

export type CompatibilityRepairProposal = z.infer<typeof CompatibilityRepairProposalSchema>;

export const CompatibilityRepairProposalRunSchema = z.object({
  model: z.literal("gpt-5.6"),
  source: z.enum(["openai", "cached-demo"]),
  proposal: CompatibilityRepairProposalSchema,
}).strict();

export type CompatibilityRepairProposalRun = z.infer<typeof CompatibilityRepairProposalRunSchema>;

export const SyntaxProbeResultSchema = z.object({
  command: z.literal("node --check src/theme.js"),
  exitCode: z.number().int(),
  passed: z.boolean(),
  durationMs: z.number().int().nonnegative(),
  stdout: z.string().max(4096),
  stderr: z.string().max(4096),
}).strict().superRefine((probe, context) => {
  if (probe.passed !== (probe.exitCode === 0)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Syntax probe pass state must match its exit code" });
  }
});

export type SyntaxProbeResult = z.infer<typeof SyntaxProbeResultSchema>;

export const CompatibilityRepairAttemptSchema = z.object({
  attempt: z.union([z.literal(1), z.literal(2)]),
  proposalRun: CompatibilityRepairProposalRunSchema,
  status: z.enum(["applied_passed", "applied_failed", "stopped"]),
  probe: SyntaxProbeResultSchema.nullable(),
}).strict().superRefine((attempt, context) => {
  if (attempt.attempt !== attempt.proposalRun.proposal.attempt) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Attempt number must match the repair proposal" });
  }
  if (attempt.status === "stopped" && attempt.probe !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Stopped attempts cannot have a syntax probe" });
  }
  if (attempt.status !== "stopped" && attempt.probe === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Applied attempts require a syntax probe" });
  }
  if (attempt.status === "applied_passed" && attempt.probe?.passed !== true) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Passed attempts require a passing probe" });
  }
  if (attempt.status === "applied_failed" && attempt.probe?.passed !== false) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Failed attempts require a failing probe" });
  }
  if (attempt.status === "stopped" && attempt.proposalRun.proposal.action === "apply_replacement") {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Stopped attempts require an explicit stop proposal" });
  }
  if (attempt.status !== "stopped" && attempt.proposalRun.proposal.action !== "apply_replacement") {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Applied attempts require a replacement proposal" });
  }
});

export type CompatibilityRepairAttempt = z.infer<typeof CompatibilityRepairAttemptSchema>;

export const CompatibilityRepairResultSchema = z.object({
  runId: z.string().regex(/^run-[0-9a-f-]{36}$/),
  planId: z.string().regex(/^plan-[a-f0-9]{64}$/),
  status: z.enum(["repaired", "failed_after_two_attempts", "stopped"]),
  file: z.literal("src/theme.js"),
  attempts: z.array(CompatibilityRepairAttemptSchema).min(1).max(2),
  changedFiles: z.array(z.enum(["package-lock.json", "package.json", "src/theme.js"])),
  sourceCheckoutClean: z.literal(true),
  sourceRestored: z.boolean(),
  sourceDiff: z.string().max(64 * 1024),
  resultLogPath: z.string().min(1),
  completedAt: z.string().datetime(),
}).strict().superRefine((result, context) => {
  if (result.attempts.some((attempt, index) => attempt.attempt !== index + 1)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Repair attempts must be ordered and contiguous" });
  }
  if (result.status !== "failed_after_two_attempts" && result.attempts.slice(0, -1).some((attempt) => attempt.status !== "applied_failed")) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Only a failed applied attempt may precede the terminal attempt" });
  }
  if (result.status === "repaired") {
    if (result.sourceRestored || result.sourceDiff.length === 0 || result.attempts.at(-1)?.status !== "applied_passed") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Repaired results require a retained passing source diff" });
    }
    if (result.changedFiles.join(",") !== "package-lock.json,package.json,src/theme.js") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Repaired results require exactly the approved three-file diff" });
    }
  }
  if (result.status === "failed_after_two_attempts") {
    if (result.attempts.length !== 2 || result.attempts.some((attempt) => attempt.status !== "applied_failed") || !result.sourceRestored || result.sourceDiff !== "") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Exhausted repairs must record two failures and restore the source" });
    }
    if (result.changedFiles.join(",") !== "package-lock.json,package.json") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Exhausted repairs must retain only the dependency update" });
    }
  }
  if (result.status === "stopped") {
    if (result.attempts.at(-1)?.status !== "stopped" || result.sourceDiff !== "" || result.sourceRestored !== (result.attempts.length === 2)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Stopped repairs cannot retain a source edit" });
    }
    if (result.changedFiles.join(",") !== "package-lock.json,package.json") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Stopped repairs must retain only the dependency update" });
    }
  }
});

export type CompatibilityRepairResult = z.infer<typeof CompatibilityRepairResultSchema>;

export const CompatibilityRepairRequestSchema = z.object({
  planId: z.string().regex(/^plan-[a-f0-9]{64}$/),
  runId: z.string().regex(/^run-[0-9a-f-]{36}$/),
}).strict();

export type CompatibilityRepairRequest = z.infer<typeof CompatibilityRepairRequestSchema>;

export const TargetedTestProposalSchema = z.object({
  action: z.enum(["add_test", "stop_unrelated", "stop_insufficient_evidence"]),
  classification: z.enum(["mitigation_regression", "unrelated_failure", "insufficient_evidence"]),
  explanation: z.string().min(1).max(2000),
  file: z.literal("test/theme.test.js").nullable(),
  insertion: z.literal("before_final_suite_close").nullable(),
  testName: z.string().min(1).max(160).nullable(),
  testText: z.string().min(1).max(4096).nullable(),
  safetyRationale: z.array(z.string().min(1)).min(1).max(6),
  remainingUnknowns: z.array(z.string().min(1)).min(1).max(6),
}).strict().superRefine((proposal, context) => {
  if (proposal.action === "add_test") {
    if (proposal.classification !== "mitigation_regression") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Added tests require a mitigation-regression classification" });
    }
    if (proposal.file === null || proposal.insertion === null || proposal.testName === null || proposal.testText === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Added tests require file, insertion, name, and text" });
    }
  } else if (proposal.file !== null || proposal.insertion !== null || proposal.testName !== null || proposal.testText !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Stopped test generation cannot include an edit" });
  }
  if (proposal.action === "stop_unrelated" && proposal.classification !== "unrelated_failure") {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Unrelated stops require an unrelated-failure classification" });
  }
  if (proposal.action === "stop_insufficient_evidence" && proposal.classification !== "insufficient_evidence") {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Insufficient-evidence stops require the matching classification" });
  }
});

export type TargetedTestProposal = z.infer<typeof TargetedTestProposalSchema>;

export const TargetedTestProposalRunSchema = z.object({
  model: z.literal("gpt-5.6"),
  source: z.enum(["openai", "cached-demo"]),
  proposal: TargetedTestProposalSchema,
}).strict();

export type TargetedTestProposalRun = z.infer<typeof TargetedTestProposalRunSchema>;

export const TargetedTestCommandResultSchema = z.object({
  command: z.literal("node --test test/theme.test.js"),
  exitCode: z.number().int(),
  passed: z.boolean(),
  durationMs: z.number().int().nonnegative(),
  stdout: z.string().max(32 * 1024),
  stderr: z.string().max(32 * 1024),
  outputTruncated: z.boolean(),
}).strict().superRefine((result, context) => {
  if (result.passed !== (result.exitCode === 0)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Targeted test pass state must match its exit code" });
  }
});

export type TargetedTestCommandResult = z.infer<typeof TargetedTestCommandResultSchema>;

export const TargetedTestResultSchema = z.object({
  runId: z.string().regex(/^run-[0-9a-f-]{36}$/),
  planId: z.string().regex(/^plan-[a-f0-9]{64}$/),
  status: z.enum(["test_added_passed", "test_failed_restored", "stopped"]),
  file: z.literal("test/theme.test.js"),
  proposalRun: TargetedTestProposalRunSchema,
  commandResult: TargetedTestCommandResultSchema.nullable(),
  changedFiles: z.array(z.enum(["package-lock.json", "package.json", "src/theme.js", "test/theme.test.js"])),
  sourceCheckoutClean: z.literal(true),
  testRestored: z.boolean(),
  testDiff: z.string().max(64 * 1024),
  resultLogPath: z.string().min(1),
  completedAt: z.string().datetime(),
}).strict().superRefine((result, context) => {
  const dependencyAndSource = "package-lock.json,package.json,src/theme.js";
  const fullPatch = `${dependencyAndSource},test/theme.test.js`;
  if (result.status === "test_added_passed") {
    if (result.proposalRun.proposal.action !== "add_test" || result.commandResult?.passed !== true || result.testRestored || result.testDiff.length === 0 || result.changedFiles.join(",") !== fullPatch) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Passing targeted tests require the retained approved four-file diff" });
    }
  }
  if (result.status === "test_failed_restored") {
    if (result.proposalRun.proposal.action !== "add_test" || result.commandResult?.passed !== false || !result.testRestored || result.testDiff !== "" || result.changedFiles.join(",") !== dependencyAndSource) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Failed targeted tests must restore the test file" });
    }
  }
  if (result.status === "stopped") {
    if (result.proposalRun.proposal.action === "add_test" || result.commandResult !== null || result.testRestored || result.testDiff !== "" || result.changedFiles.join(",") !== dependencyAndSource) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Stopped test generation cannot retain or execute a test" });
    }
  }
});

export type TargetedTestResult = z.infer<typeof TargetedTestResultSchema>;

export const TargetedTestRequestSchema = z.object({
  planId: z.string().regex(/^plan-[a-f0-9]{64}$/),
  runId: z.string().regex(/^run-[0-9a-f-]{36}$/),
}).strict();

export type TargetedTestRequest = z.infer<typeof TargetedTestRequestSchema>;

export const NormalizedScanResultSchema = z.object({
  scanner: z.literal("osv-scanner"),
  scannerVersion: z.string().min(1),
  repositoryPath: z.string().min(1),
  scannedAt: z.string().datetime(),
  findings: z.array(VulnerabilityFindingSchema),
});

export type NormalizedScanResult = z.infer<typeof NormalizedScanResultSchema>;

const VerificationCommandSchema = z.enum([
  "npm ci --ignore-scripts",
  "node --test test/theme.test.js",
  "npm test",
  "npm run build",
  "osv-scanner scan source --lockfile package-lock.json --format json --verbosity error",
]);

export const VerificationCommandResultSchema = z.object({
  phase: z.enum(["baseline", "post_patch", "rescan"]),
  kind: z.enum(["install", "targeted_test", "full_test", "build", "rescan"]),
  command: VerificationCommandSchema,
  status: z.enum(["passed", "failed", "findings_present"]),
  exitCode: z.number().int(),
  durationMs: z.number().int().nonnegative(),
  stdoutSummary: z.string().max(32 * 1024),
  stderrSummary: z.string().max(32 * 1024),
  outputTruncated: z.boolean(),
}).strict().superRefine((result, context) => {
  const expectedCommand = {
    install: "npm ci --ignore-scripts",
    targeted_test: "node --test test/theme.test.js",
    full_test: "npm test",
    build: "npm run build",
    rescan: "osv-scanner scan source --lockfile package-lock.json --format json --verbosity error",
  } as const;
  if (result.command !== expectedCommand[result.kind]) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Verification command must match its declared kind" });
  }
  if (result.kind === "targeted_test" && result.phase !== "post_patch") {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Targeted tests run only in the post-patch phase" });
  }
  if (result.status === "passed" && result.exitCode !== 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Passing verification commands require exit code 0" });
  }
  if (result.status === "findings_present" && (result.kind !== "rescan" || result.phase !== "rescan" || result.exitCode !== 1)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Scanner findings require the rescan command and exit code 1" });
  }
  if (result.kind === "rescan" && result.command !== "osv-scanner scan source --lockfile package-lock.json --format json --verbosity error") {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Rescan results require the bounded OSV command" });
  }
  if (result.kind !== "rescan" && result.phase === "rescan") {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Only scanner commands may use the rescan phase" });
  }
});

export type VerificationCommandResult = z.infer<typeof VerificationCommandResultSchema>;

const VerificationPhaseSummarySchema = z.object({
  installPassed: z.boolean().nullable(),
  targetedTestPassed: z.boolean().nullable(),
  fullTestsPassed: z.boolean().nullable(),
  buildPassed: z.boolean().nullable(),
}).strict();

export const VerificationFailureSchema = z.object({
  classification: z.enum([
    "baseline_install_failed",
    "baseline_tests_failed",
    "baseline_build_failed",
    "post_patch_install_failed",
    "targeted_test_failed",
    "full_tests_failed",
    "post_patch_build_failed",
    "rescan_execution_failed",
    "selected_advisory_still_detected",
  ]),
  phase: z.enum(["baseline", "post_patch", "rescan"]),
  command: VerificationCommandSchema,
  summary: z.string().min(1).max(2000),
}).strict();

export type VerificationFailure = z.infer<typeof VerificationFailureSchema>;

export const VerificationRescanSchema = z.object({
  scanner: z.literal("osv-scanner"),
  scannerVersion: z.string().min(1),
  scannedAt: z.string().datetime(),
  findingCount: z.number().int().nonnegative(),
  selectedAdvisoryId: z.literal("GHSA-9c47-m6qq-7p4h"),
  selectedAdvisoryPresent: z.boolean(),
  findings: z.array(VulnerabilityFindingSchema),
}).strict().superRefine((rescan, context) => {
  if (rescan.findingCount !== rescan.findings.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Rescan finding count must match normalized findings" });
  }
  const selectedPresent = rescan.findings.some((finding) => finding.id === rescan.selectedAdvisoryId);
  if (selectedPresent !== rescan.selectedAdvisoryPresent) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Selected advisory state must match normalized findings" });
  }
});

export type VerificationRescan = z.infer<typeof VerificationRescanSchema>;

export const VerificationResultSchema = z.object({
  runId: z.string().regex(/^run-[0-9a-f-]{36}$/),
  planId: z.string().regex(/^plan-[a-f0-9]{64}$/),
  status: z.enum(["verified", "failed"]),
  selectedAdvisoryId: z.literal("GHSA-9c47-m6qq-7p4h"),
  commands: z.array(VerificationCommandResultSchema).min(1).max(8),
  baseline: VerificationPhaseSummarySchema,
  postPatch: VerificationPhaseSummarySchema,
  rescan: VerificationRescanSchema.nullable(),
  failure: VerificationFailureSchema.nullable(),
  changedFiles: z.array(z.enum(["package-lock.json", "package.json", "src/theme.js", "test/theme.test.js"])),
  sourceCheckoutClean: z.literal(true),
  resultLogPath: z.string().min(1),
  completedAt: z.string().datetime(),
}).strict().superRefine((result, context) => {
  const fullPatch = "package-lock.json,package.json,src/theme.js,test/theme.test.js";
  if (result.changedFiles.join(",") !== fullPatch) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Verification must preserve the approved four-file diff" });
  }
  if (result.status === "verified") {
    const allPassed = result.baseline.installPassed === true
      && result.baseline.fullTestsPassed === true
      && result.baseline.buildPassed === true
      && result.postPatch.installPassed === true
      && result.postPatch.targetedTestPassed === true
      && result.postPatch.fullTestsPassed === true
      && result.postPatch.buildPassed === true;
    const expectedSequence = [
      "baseline:install",
      "baseline:full_test",
      "baseline:build",
      "post_patch:install",
      "post_patch:targeted_test",
      "post_patch:full_test",
      "post_patch:build",
      "rescan:rescan",
    ];
    const actualSequence = result.commands.map((command) => `${command.phase}:${command.kind}`);
    const commandsPassed = result.commands.slice(0, 7).every((command) => command.status === "passed")
      && result.commands[7]?.status !== "failed";
    if (!allPassed || result.baseline.targetedTestPassed !== null || result.failure !== null || result.rescan?.selectedAdvisoryPresent !== false || actualSequence.join(",") !== expectedSequence.join(",") || !commandsPassed) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Verified results require every command to pass and the selected advisory to disappear" });
    }
  } else if (result.failure === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Failed verification requires an honest failure classification" });
  } else {
    const lastCommand = result.commands.at(-1);
    const expectedFailure = {
      baseline_install_failed: ["baseline", "install"],
      baseline_tests_failed: ["baseline", "full_test"],
      baseline_build_failed: ["baseline", "build"],
      post_patch_install_failed: ["post_patch", "install"],
      targeted_test_failed: ["post_patch", "targeted_test"],
      full_tests_failed: ["post_patch", "full_test"],
      post_patch_build_failed: ["post_patch", "build"],
      rescan_execution_failed: ["rescan", "rescan"],
      selected_advisory_still_detected: ["rescan", "rescan"],
    } as const;
    const [expectedPhase, expectedKind] = expectedFailure[result.failure.classification];
    const selectedAdvisoryFailure = result.failure.classification === "selected_advisory_still_detected";
    if (
      !lastCommand
      || lastCommand.phase !== expectedPhase
      || lastCommand.kind !== expectedKind
      || lastCommand.command !== result.failure.command
      || result.failure.phase !== expectedPhase
      || (selectedAdvisoryFailure ? result.rescan?.selectedAdvisoryPresent !== true : lastCommand.status !== "failed")
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Verification failure classification must match the terminal command fact" });
    }
  }
});

export type VerificationResult = z.infer<typeof VerificationResultSchema>;

export const VerificationRequestSchema = z.object({
  planId: z.string().regex(/^plan-[a-f0-9]{64}$/),
  runId: z.string().regex(/^run-[0-9a-f-]{36}$/),
}).strict();

export type VerificationRequest = z.infer<typeof VerificationRequestSchema>;

export const InvestigationResultSchema = z.object({
  finding: VulnerabilityFindingSchema,
  advisory: NormalizedAdvisorySchema,
  evidence: RepositoryEvidenceBundleSchema,
  assessmentRun: AssessmentRunSchema,
}).strict();

export type InvestigationResult = z.infer<typeof InvestigationResultSchema>;
