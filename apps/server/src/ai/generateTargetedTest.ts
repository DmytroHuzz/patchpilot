import { readFile } from "node:fs/promises";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  TargetedTestProposalRunSchema,
  TargetedTestProposalSchema,
  type TargetedTestProposalRun,
} from "@patchpilot/contracts";
import type { TargetedTestContext } from "./targetedTestContext.js";
import { targetedTestInstructions } from "./targetedTestPrompt.js";
import { validateTargetedTest } from "./validateTargetedTest.js";

export interface GenerateTargetedTestOptions {
  context: TargetedTestContext;
  apiKey?: string;
  client?: OpenAI;
}

export async function generateTargetedTestWithOpenAI(options: GenerateTargetedTestOptions): Promise<TargetedTestProposalRun> {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!options.client && !apiKey) throw new Error("OPENAI_API_KEY is required for live GPT-5.6 targeted test generation");
  const client = options.client ?? new OpenAI({ apiKey });
  const response = await client.responses.parse({
    model: "gpt-5.6",
    instructions: targetedTestInstructions,
    input: JSON.stringify(options.context),
    reasoning: { effort: "medium" },
    store: false,
    text: {
      format: zodTextFormat(TargetedTestProposalSchema, "targeted_regression_test"),
      verbosity: "low",
    },
  });
  if (!response.output_parsed) throw new Error("GPT-5.6 returned no parsed targeted test proposal");
  return TargetedTestProposalRunSchema.parse({
    model: "gpt-5.6",
    source: "openai",
    proposal: validateTargetedTest(response.output_parsed, options.context),
  });
}

export async function loadCachedTargetedTest(fixturePath: string, context: TargetedTestContext): Promise<TargetedTestProposalRun> {
  const run = TargetedTestProposalRunSchema.parse(JSON.parse(await readFile(fixturePath, "utf8")));
  if (run.source !== "cached-demo") throw new Error("Cached targeted test must be labeled cached-demo");
  return { ...run, proposal: validateTargetedTest(run.proposal, context) };
}

export async function resolveTargetedTest(options: GenerateTargetedTestOptions & { fixturePath: string }): Promise<TargetedTestProposalRun> {
  if (options.client || options.apiKey || process.env.OPENAI_API_KEY) return generateTargetedTestWithOpenAI(options);
  return loadCachedTargetedTest(options.fixturePath, options.context);
}
