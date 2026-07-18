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

export const NormalizedScanResultSchema = z.object({
  scanner: z.literal("osv-scanner"),
  scannerVersion: z.string().min(1),
  repositoryPath: z.string().min(1),
  scannedAt: z.string().datetime(),
  findings: z.array(VulnerabilityFindingSchema),
});

export type NormalizedScanResult = z.infer<typeof NormalizedScanResultSchema>;
