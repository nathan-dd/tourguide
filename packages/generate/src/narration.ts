import type { Tour } from '@tourguide/format';
import { tourSchema } from '@tourguide/format';
import type { LanguageModel } from 'ai';
import { Output, generateText } from 'ai';
import { buildNarrationPrompt } from './prompts.js';
import type { ProgressCallback } from './types.js';

export async function runNarration(options: {
  model: LanguageModel;
  synthesis: string;
  diff: string;
  baseRef: string;
  headRef: string;
  modelId: string;
  packageVersion: string;
  onProgress?: ProgressCallback;
}): Promise<Tour> {
  const { model, synthesis, diff, baseRef, headRef, modelId, packageVersion, onProgress } = options;
  const { system, prompt } = buildNarrationPrompt({ synthesis, diff, baseRef, headRef });

  const result = await generateText({
    model,
    system,
    prompt,
    output: Output.object({ schema: tourSchema }),
    onStepFinish: (event) => {
      onProgress?.('Narration step finished', { step: event.stepNumber });
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
