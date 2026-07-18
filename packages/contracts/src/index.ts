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

export const NormalizedScanResultSchema = z.object({
  scanner: z.literal("osv-scanner"),
  scannerVersion: z.string().min(1),
  repositoryPath: z.string().min(1),
  scannedAt: z.string().datetime(),
  findings: z.array(VulnerabilityFindingSchema),
});

export type NormalizedScanResult = z.infer<typeof NormalizedScanResultSchema>;

export const InvestigationResultSchema = z.object({
  finding: VulnerabilityFindingSchema,
  advisory: NormalizedAdvisorySchema,
  evidence: RepositoryEvidenceBundleSchema,
  assessmentRun: AssessmentRunSchema,
}).strict();

export type InvestigationResult = z.infer<typeof InvestigationResultSchema>;
