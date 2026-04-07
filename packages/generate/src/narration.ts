import type { Tour } from '@tourguide/format';
import { diffTourSchema } from '@tourguide/format';
import type { LanguageModel } from 'ai';
import { Output, generateText } from 'ai';
import { buildNarrationPrompt } from './prompts.js';
import type { ProgressCallback, StepDetailCallback } from './types.js';

const narrationSchema = diffTourSchema.omit({ $schema: true });

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

  const tour = result.output;
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
