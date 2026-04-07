import type { Tour } from '@tourguide/format';
import { diffTourSchema } from '@tourguide/format';
import type { LanguageModel } from 'ai';
import { Output, generateText, jsonSchema } from 'ai';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { buildNarrationPrompt } from './prompts.js';
import type { ProgressCallback, StepDetailCallback } from './types.js';

type JsonSchemaNode = Record<string, unknown>;

/**
 * Anthropic rejects:
 *   - `minimum`/`maximum` on `integer` typed properties
 *   - top-level `$schema` key
 * Strip both before sending. Uses `$refStrategy: 'none'` upstream so there
 * are no `$ref`/`$defs` nodes to worry about.
 */
function sanitizeForAnthropic(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sanitizeForAnthropic);
  if (typeof node !== 'object' || node === null) return node;

  const obj = node as JsonSchemaNode;
  const result: JsonSchemaNode = {};

  for (const [key, value] of Object.entries(obj)) {
    if (key === '$schema') continue;
    if (obj.type === 'integer' && (key === 'minimum' || key === 'maximum')) continue;
    result[key] = sanitizeForAnthropic(value);
  }

  return result;
}

// Omit $schema ($ prefix) and generatedBy (contains z.record(z.unknown()) which
// produces an empty `{}` schema Anthropic rejects). generatedBy is set by the
// pipeline in post-processing, so the LLM doesn't need to generate it.
// Use $refStrategy:'none' to inline all sub-schemas — avoids $ref/$defs nodes.
const baseJsonSchema = zodToJsonSchema(
  diffTourSchema.omit({ $schema: true, generatedBy: true }),
  { target: 'jsonSchema7', $refStrategy: 'none' },
);
const narrationSchema = jsonSchema(sanitizeForAnthropic(baseJsonSchema) as JsonSchemaNode);

export async function runNarration(options: {
  model: LanguageModel;
  synthesis: string;
  diff: string;
  baseRef: string;
  headRef: string;
  modelId: string;
  packageVersion: string;
  onProgress?: ProgressCallback;
  onStepDetail?: StepDetailCallback;
  promptAppend?: string;
}): Promise<Tour> {
  const {
    model,
    synthesis,
    diff,
    baseRef,
    headRef,
    modelId,
    packageVersion,
    onProgress,
    onStepDetail,
    promptAppend,
  } = options;
  const { system, prompt } = buildNarrationPrompt({
    synthesis,
    diff,
    baseRef,
    headRef,
    promptAppend,
  });

  const result = await generateText({
    model,
    system,
    prompt,
    output: Output.object({ schema: narrationSchema }),
    onStepFinish: (event) => {
      onProgress?.('Narration step finished', { step: event.stepNumber });
      onStepDetail?.({
        phase: 'narration',
        stepNumber: event.stepNumber,
        text: event.text,
        toolCalls: [],
        toolResults: [],
      });
    },
  });

  const tour = result.output as Tour;
  const prev = tour.generatedBy;
  const prevMeta =
    prev?.metadata && typeof prev.metadata === 'object' && !Array.isArray(prev.metadata)
      ? (prev.metadata as Record<string, unknown>)
      : {};

  return {
    ...tour,
    generatedBy: {
      ...prev,
      tool: 'tourguide',
      version: packageVersion,
      model: modelId,
      metadata: { ...prevMeta, baseRef, headRef },
    },
  };
}
