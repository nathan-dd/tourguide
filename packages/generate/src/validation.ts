import {
  type Tour,
  type ValidationError,
  type ValidationResult,
  type ValidationWarning,
  validate,
} from '@tourguide/format';
import { runNarration } from './narration.js';

export function validateTour(data: unknown): ValidationResult {
  return validate(data);
}

function errorsAsWarnings(errors: ValidationError[]): ValidationWarning[] {
  return errors.map((e) => ({
    path: e.path,
    message: e.message,
    code: e.code,
  }));
}

/**
 * Runs narration, validates the tour, and retries narration once if validation fails
 * (without re-running discovery). Appends semantic errors as JSON to the user prompt on retry.
 */
export async function runNarrationWithRetry(options: Parameters<typeof runNarration>[0]): Promise<{
  tour: Tour;
  warnings: ValidationWarning[];
  semanticErrors?: ValidationError[];
}> {
  let tour = await runNarration(options);
  let validation = validateTour(tour);
  if (validation.success) {
    return { tour: validation.tour, warnings: validation.warnings };
  }

  tour = await runNarration({
    ...options,
    promptAppend: `\n\nPrevious output had semantic errors: ${JSON.stringify(validation.errors)}. Fix them.`,
  });
  validation = validateTour(tour);
  if (validation.success) {
    return { tour: validation.tour, warnings: validation.warnings };
  }

  return {
    tour,
    warnings: errorsAsWarnings(validation.errors),
    semanticErrors: validation.errors,
  };
}
