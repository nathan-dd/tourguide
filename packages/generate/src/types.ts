import type { Tour, ValidationWarning } from '@tourguide/format';
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
};

export type GenerateResult = {
  tour: Tour;
  warnings: ValidationWarning[];
};
