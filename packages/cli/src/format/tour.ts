import type { TourProgress } from '@tourguide/core';
import type { Chapter, Step, Tour } from '@tourguide/format';
import chalk from 'chalk';
import { formatCodeBlock } from './code.js';

export function formatStepDisplay(
  progress: TourProgress,
  chapter: Chapter,
  step: Step,
  sourceCode: string | null,
): string {
  const parts: string[] = [];

  parts.push(
    chalk.dim(`  Chapter ${progress.chapter.current}/${progress.chapter.total}: ${chapter.title}`),
  );
  parts.push(
    `  ${chalk.bold(`Step ${progress.overallStep.current}/${progress.overallStep.total}`)} — ${step.title}`,
  );
  parts.push('');
  parts.push(`  ${chalk.cyan(`${step.file}:${step.range.start.line}-${step.range.end.line}`)}`);

  if (sourceCode) {
    parts.push('');
    parts.push(formatCodeBlock(sourceCode, step.range.start.line));
  }

  parts.push('');
  parts.push(`  ${step.description}`);

  return parts.join('\n');
}

export function formatChapterTransition(
  chapter: Chapter,
  chapterNum: number,
  totalChapters: number,
): string {
  const bar = chalk.bold('━'.repeat(50));
  return [
    bar,
    `  ${chalk.bold(`Chapter ${chapterNum}/${totalChapters}: ${chapter.title}`)}`,
    `  ${chalk.dim(chapter.summary)}`,
    bar,
  ].join('\n');
}

export const STEP_SEPARATOR = chalk.dim('─'.repeat(50));

function formatRelevance(relevance: string): string {
  switch (relevance) {
    case 'primary':
      return chalk.green(relevance);
    case 'secondary':
      return chalk.yellow(relevance);
    case 'context':
      return chalk.dim(relevance);
    default:
      return relevance;
  }
}

function formatMode(tour: Tour): string {
  if (tour.mode === 'diff') {
    return `diff (${tour.baseRef}..${tour.headRef})`;
  }
  return tour.ref ? `codebase (${tour.ref})` : 'codebase';
}

export function formatSummary(tour: Tour): string {
  const parts: string[] = [];

  parts.push(chalk.bold(tour.title));
  parts.push(chalk.dim(tour.description));
  parts.push('');
  parts.push(`  ${chalk.dim('Mode:')} ${formatMode(tour)}`);
  parts.push('');
  parts.push(tour.overview.summary);

  parts.push('');
  parts.push(chalk.bold('Chapters'));
  for (let i = 0; i < tour.chapters.length; i += 1) {
    const chapter = tour.chapters[i];
    const count = chapter.steps.length;
    const noun = count === 1 ? 'step' : 'steps';
    parts.push(
      `  ${i + 1}. ${chapter.title} — ${chalk.dim(`${count} ${noun}`)} — ${chapter.summary}`,
    );
  }

  if (tour.overview.fileMap.length > 0) {
    parts.push('');
    parts.push(chalk.bold('File Map'));
    for (const entry of tour.overview.fileMap) {
      parts.push(
        `  ${formatRelevance(entry.relevance)}  ${chalk.cyan(entry.file)}  ${chalk.dim(entry.description)}`,
      );
    }
  }

  return parts.join('\n');
}
