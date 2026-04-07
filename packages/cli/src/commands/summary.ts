import { TourLoadError, loadTour } from '@tourguide/core';
import { formatFileResult } from '../format/errors.js';
import { formatSummary } from '../format/tour.js';
import { type Output, consoleOutput } from '../output.js';

export async function summary(file: string, output: Output = consoleOutput): Promise<number> {
  try {
    const tour = await loadTour(file);
    output.log(formatSummary(tour));
    return 0;
  } catch (error) {
    if (error instanceof TourLoadError) {
      output.error(formatFileResult(file, { success: false, errors: error.errors }));
    } else {
      output.error(
        formatFileResult(file, {
          success: false,
          errors: [
            {
              path: '$',
              message: error instanceof Error ? error.message : 'Unknown error',
              code: 'unknown-error',
            },
          ],
        }),
      );
    }
    return 1;
  }
}
