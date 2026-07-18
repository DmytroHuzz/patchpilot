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

export const NormalizedScanResultSchema = z.object({
  scanner: z.literal("osv-scanner"),
  scannerVersion: z.string().min(1),
  repositoryPath: z.string().min(1),
  scannedAt: z.string().datetime(),
  findings: z.array(VulnerabilityFindingSchema),
});

export type NormalizedScanResult = z.infer<typeof NormalizedScanResultSchema>;
