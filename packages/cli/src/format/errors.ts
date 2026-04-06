import type { ValidationError } from '@tourguide/format';
import chalk from 'chalk';

export function formatValidationError(error: ValidationError): string {
  const path = error.path === '$' ? '' : ` ${chalk.dim(error.path)}`;
  return `  ${chalk.red('✗')}${path} — ${error.message}`;
}

type FileSuccess = {
  success: true;
  title: string;
  chapterCount: number;
  stepCount: number;
};

type FileFailure = {
  success: false;
  errors: ValidationError[];
};

export type FileResult = FileSuccess | FileFailure;

export function formatFileResult(file: string, result: FileResult): string {
  if (result.success) {
    return `${chalk.green('✓')} ${chalk.bold(file)} — ${result.title} (${result.chapterCount} chapters, ${result.stepCount} steps)`;
  }

  const header = `${chalk.red('✗')} ${chalk.bold(file)}`;
  const errorLines = result.errors.map(formatValidationError);
  return [header, ...errorLines].join('\n');
}
