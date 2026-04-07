import { readFile } from 'node:fs/promises';
import { dirname, resolve as pathResolve } from 'node:path';
import type { TourPosition, TourProgress } from '@tourguide/core';
import {
  TourLoadError,
  firstPosition,
  getChapter,
  getProgress,
  getStep,
  loadTour,
  nextStep,
  resolveStep,
  totalSteps,
} from '@tourguide/core';
import type { Chapter, Step, Tour } from '@tourguide/format';
import chalk from 'chalk';
import { formatFileResult } from '../format/errors.js';
import { STEP_SEPARATOR, formatChapterTransition, formatStepDisplay } from '../format/tour.js';
import { type Output, consoleOutput } from '../output.js';

export function renderTourHeader(
  tour: Pick<Tour, 'title' | 'description'>,
  output: Output = consoleOutput,
): void {
  output.log('');
  output.log(chalk.bold(tour.title));
  output.log(chalk.dim(tour.description));
  output.log('');
  output.log(chalk.dim('  Press Enter to advance, q to quit'));
  output.log('');
}

export function renderTourComplete(stepsVisited: number, output: Output = consoleOutput): void {
  output.log('');
  output.log(chalk.green.bold('  Tour complete'));
  output.log(chalk.dim(`  ${stepsVisited} steps visited`));
  output.log('');
}

export function renderTourStep(
  progress: TourProgress,
  chapter: Chapter,
  step: Step,
  sourceCode: string | null,
  isChapterTransition: boolean,
  output: Output = consoleOutput,
): void {
  if (isChapterTransition) {
    output.log(formatChapterTransition(chapter, progress.chapter.current, progress.chapter.total));
  } else {
    output.log(STEP_SEPARATOR);
  }
  output.log('');
  output.log(formatStepDisplay(progress, chapter, step, sourceCode));
  output.log('');
}

async function tryReadSource(step: Step, tourDir: string): Promise<string | null> {
  try {
    const filePath = pathResolve(tourDir, step.file);
    const content = await readFile(filePath, 'utf8');
    const resolved = resolveStep(step, content);
    return resolved?.text ?? null;
  } catch {
    return null;
  }
}

export async function play(file: string, output: Output = consoleOutput): Promise<number> {
  let tour: Tour;
  try {
    tour = await loadTour(file);
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

  const startPos = firstPosition(tour);
  if (!startPos) {
    output.log(chalk.yellow('Tour has no steps.'));
    return 0;
  }

  const tourDir = dirname(pathResolve(file));

  renderTourHeader(tour, output);

  let position: TourPosition = startPos;
  let prevChapterIndex = -1;
  let stepsVisited = 0;

  const showStep = async (pos: TourPosition) => {
    const chapter = getChapter(tour, pos);
    const step = getStep(tour, pos);
    const progress = getProgress(tour, pos);
    const isChapterTransition = pos.chapterIndex !== prevChapterIndex;
    const sourceCode = await tryReadSource(step, tourDir);

    renderTourStep(progress, chapter, step, sourceCode, isChapterTransition, output);
    prevChapterIndex = pos.chapterIndex;
    stepsVisited += 1;
  };

  await showStep(position);

  return new Promise<number>((resolvePromise) => {
    if (!process.stdin.isTTY) {
      renderTourComplete(stepsVisited, output);
      resolvePromise(0);
      return;
    }

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };

    const onData = async (key: string) => {
      if (key === 'q' || key === '\u0003') {
        process.stdin.removeListener('data', onData);
        cleanup();
        output.log('');
        output.log(chalk.dim(`  Quit after ${stepsVisited}/${totalSteps(tour)} steps`));
        output.log('');
        resolvePromise(0);
        return;
      }

      if (key === '\r' || key === '\n' || key === '\u001b[C') {
        const next = nextStep(tour, position);
        if (!next) {
          process.stdin.removeListener('data', onData);
          cleanup();
          renderTourComplete(stepsVisited, output);
          resolvePromise(0);
          return;
        }
        position = next;
        await showStep(position);
      }
    };

    process.stdin.on('data', onData);
  });
}
