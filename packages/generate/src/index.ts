import type { GenerateOptions, GenerateResult } from './types.js';

export type {
  GenerateOptions,
  GenerateResult,
  ProgressCallback,
} from './types.js';

export async function generateTour(_options: GenerateOptions): Promise<GenerateResult> {
  throw new Error('not implemented');
}
