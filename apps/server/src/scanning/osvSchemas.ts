import { z } from "zod";

const eventSchema = z.object({
  introduced: z.string().optional(),
  fixed: z.string().optional(),
  last_affected: z.string().optional(),
  limit: z.string().optional(),
});

const affectedSchema = z.object({
  package: z.object({
    name: z.string(),
    ecosystem: z.string(),
  }),
  ranges: z.array(z.object({
    type: z.string(),
    events: z.array(eventSchema),
  })).default([]),
});

const vulnerabilitySchema = z.object({
  id: z.string(),
  aliases: z.array(z.string()).default([]),
  summary: z.string().default("No advisory summary supplied"),
  details: z.string().default(""),
  affected: z.array(affectedSchema).default([]),
  references: z.array(z.object({ url: z.string() })).default([]),
  database_specific: z.object({ severity: z.string().optional() }).passthrough().optional(),
});

const packageSchema = z.object({
  package: z.object({
    name: z.string(),
    version: z.string(),
    ecosystem: z.string(),
  }),
  groups: z.array(z.object({
    ids: z.array(z.string()).default([]),
    max_severity: z.string().optional(),
  })).default([]),
  vulnerabilities: z.array(vulnerabilitySchema).default([]),
});

export const OsvScannerOutputSchema = z.object({
  results: z.array(z.object({
    source: z.object({
      path: z.string(),
      type: z.string(),
    }),
    packages: z.array(packageSchema).default([]),
  })).default([]),
});

export type OsvScannerOutput = z.infer<typeof OsvScannerOutputSchema>;

