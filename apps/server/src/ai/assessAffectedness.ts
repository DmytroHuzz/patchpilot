import { readFile } from "node:fs/promises";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  AssessmentRunSchema,
  AffectednessAssessmentSchema,
  type AssessmentRun,
  type RepositoryEvidenceBundle,
} from "@patchpilot/contracts";
import { affectednessInstructions } from "./affectednessPrompt.js";
import type { AffectednessContext } from "./affectednessContext.js";
import { validateAffectednessAssessment } from "./validateAssessment.js";

export interface AssessAffectednessOptions {
  context: AffectednessContext;
  evidence: RepositoryEvidenceBundle;
  apiKey?: string;
  client?: OpenAI;
}

export async function assessAffectednessWithOpenAI(options: AssessAffectednessOptions): Promise<AssessmentRun> {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!options.client && !apiKey) {
    throw new Error("OPENAI_API_KEY is required for a live GPT-5.6 assessment");
  }

  const client = options.client ?? new OpenAI({ apiKey });
  const response = await client.responses.parse({
    model: "gpt-5.6",
    instructions: affectednessInstructions,
    input: JSON.stringify(options.context),
    reasoning: { effort: "medium" },
    store: false,
    text: {
      format: zodTextFormat(AffectednessAssessmentSchema, "affectedness_assessment"),
      verbosity: "low",
    },
  });
  if (!response.output_parsed) throw new Error("GPT-5.6 returned no parsed affectedness assessment");

  return AssessmentRunSchema.parse({
    model: "gpt-5.6",
    source: "openai",
    assessment: validateAffectednessAssessment(response.output_parsed, options.evidence),
  });
}

export async function loadCachedAssessment(
  fixturePath: string,
  evidence: RepositoryEvidenceBundle,
): Promise<AssessmentRun> {
  const parsed = JSON.parse(await readFile(fixturePath, "utf8"));
  const run = AssessmentRunSchema.parse(parsed);
  if (run.source !== "cached-demo") throw new Error("Cached assessment must be labeled cached-demo");
  return {
    ...run,
    assessment: validateAffectednessAssessment(run.assessment, evidence),
  };
}

export async function resolveAffectednessAssessment(options: AssessAffectednessOptions & {
  fixturePath: string;
}): Promise<AssessmentRun> {
  if (options.client || options.apiKey || process.env.OPENAI_API_KEY) {
    return assessAffectednessWithOpenAI(options);
  }
  return loadCachedAssessment(options.fixturePath, options.evidence);
}
