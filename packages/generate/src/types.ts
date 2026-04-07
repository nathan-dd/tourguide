import type { Tour, ValidationError, ValidationWarning } from '@tourguide/format';
import type { LanguageModel } from 'ai';

export type ProgressCallback = (
  message: string,
  detail?: { step?: number; maxSteps?: number },
) => void;

export type GenerateOptions = {
  repoPath: string;
  baseRef: string;
  headRef: string;
  model: LanguageModel;
  maxSteps?: number;
  onProgress?: ProgressCallback;
};

/** Options for {@link generateTour}; includes identity metadata for `tour.generatedBy`. */
export type GenerateTourOptions = GenerateOptions & {
  modelId: string;
  packageVersion: string;
};

export type GenerateResult = {
  tour: Tour;
  warnings: ValidationWarning[];
  /** Present when the tour failed validation after one narration retry (best-effort output). */
  semanticErrors?: ValidationError[];
};
