import { TourLoadError, loadTour, totalSteps } from '@tourguide/core';
import { formatFileResult } from '../format/errors.js';
import { type Output, consoleOutput } from '../output.js';

export async function validate(files: string[], output: Output = consoleOutput): Promise<number> {
  let hasErrors = false;

  for (const file of files) {
    try {
      const tour = await loadTour(file);
      output.log(
        formatFileResult(file, {
          success: true,
          title: tour.title,
          chapterCount: tour.chapters.length,
          stepCount: totalSteps(tour),
        }),
      );
    } catch (error) {
      hasErrors = true;
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
    }
  }

  return hasErrors ? 1 : 0;
}
