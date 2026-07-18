import { readFile } from "node:fs/promises";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  CompatibilityRepairProposalRunSchema,
  CompatibilityRepairProposalSchema,
  type CompatibilityRepairProposalRun,
} from "@patchpilot/contracts";
import type { CompatibilityRepairContext } from "./compatibilityRepairContext.js";
import { compatibilityRepairInstructions } from "./compatibilityRepairPrompt.js";
import { validateCompatibilityRepair } from "./validateCompatibilityRepair.js";

export interface RepairCompatibilityOptions {
  context: CompatibilityRepairContext;
  apiKey?: string;
  client?: OpenAI;
}

export async function repairCompatibilityWithOpenAI(options: RepairCompatibilityOptions): Promise<CompatibilityRepairProposalRun> {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!options.client && !apiKey) throw new Error("OPENAI_API_KEY is required for a live GPT-5.6 compatibility repair");
  const client = options.client ?? new OpenAI({ apiKey });
  const response = await client.responses.parse({
    model: "gpt-5.6",
    instructions: compatibilityRepairInstructions,
    input: JSON.stringify(options.context),
    reasoning: { effort: "medium" },
    store: false,
    text: {
      format: zodTextFormat(CompatibilityRepairProposalSchema, "compatibility_repair"),
      verbosity: "low",
    },
  });
  if (!response.output_parsed) throw new Error("GPT-5.6 returned no parsed compatibility repair");
  return CompatibilityRepairProposalRunSchema.parse({
    model: "gpt-5.6",
    source: "openai",
    proposal: validateCompatibilityRepair(response.output_parsed, options.context),
  });
}

export async function loadCachedCompatibilityRepair(
  fixturePath: string,
  context: CompatibilityRepairContext,
): Promise<CompatibilityRepairProposalRun> {
  const run = CompatibilityRepairProposalRunSchema.parse(JSON.parse(await readFile(fixturePath, "utf8")));
  if (run.source !== "cached-demo") throw new Error("Cached compatibility repair must be labeled cached-demo");
  return { ...run, proposal: validateCompatibilityRepair(run.proposal, context) };
}

export async function resolveCompatibilityRepair(options: RepairCompatibilityOptions & {
  fixturePath: string;
}): Promise<CompatibilityRepairProposalRun> {
  if (options.client || options.apiKey || process.env.OPENAI_API_KEY) return repairCompatibilityWithOpenAI(options);
  return loadCachedCompatibilityRepair(options.fixturePath, options.context);
}
