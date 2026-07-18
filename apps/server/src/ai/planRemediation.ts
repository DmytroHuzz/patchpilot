import { readFile } from "node:fs/promises";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  RemediationPlanRunSchema,
  RemediationPlanSchema,
  type RemediationPlanRun,
} from "@patchpilot/contracts";
import type { RemediationContext } from "./remediationContext.js";
import { remediationInstructions } from "./remediationPrompt.js";
import { validateRemediationPlan } from "./validateRemediationPlan.js";

export interface PlanRemediationOptions {
  context: RemediationContext;
  apiKey?: string;
  client?: OpenAI;
}

export async function planRemediationWithOpenAI(options: PlanRemediationOptions): Promise<RemediationPlanRun> {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!options.client && !apiKey) throw new Error("OPENAI_API_KEY is required for a live GPT-5.6 remediation plan");

  const client = options.client ?? new OpenAI({ apiKey });
  const response = await client.responses.parse({
    model: "gpt-5.6",
    instructions: remediationInstructions,
    input: JSON.stringify(options.context),
    reasoning: { effort: "medium" },
    store: false,
    text: {
      format: zodTextFormat(RemediationPlanSchema, "remediation_plan"),
      verbosity: "low",
    },
  });
  if (!response.output_parsed) throw new Error("GPT-5.6 returned no parsed remediation plan");

  return RemediationPlanRunSchema.parse({
    model: "gpt-5.6",
    source: "openai",
    plan: validateRemediationPlan(response.output_parsed, options.context),
  });
}

export async function loadCachedRemediationPlan(
  fixturePath: string,
  context: RemediationContext,
): Promise<RemediationPlanRun> {
  const run = RemediationPlanRunSchema.parse(JSON.parse(await readFile(fixturePath, "utf8")));
  if (run.source !== "cached-demo") throw new Error("Cached remediation plan must be labeled cached-demo");
  return { ...run, plan: validateRemediationPlan(run.plan, context) };
}

export async function resolveRemediationPlan(options: PlanRemediationOptions & {
  fixturePath: string;
}): Promise<RemediationPlanRun> {
  if (options.client || options.apiKey || process.env.OPENAI_API_KEY) {
    return planRemediationWithOpenAI(options);
  }
  return loadCachedRemediationPlan(options.fixturePath, options.context);
}
