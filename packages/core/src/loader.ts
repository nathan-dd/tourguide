import { readFile } from 'node:fs/promises';
import { type Tour, type ValidationError, validate } from '@tourguide/format';

export class TourLoadError extends Error {
  readonly errors: ValidationError[];

  constructor(message: string, errors: ValidationError[]) {
    super(message);
    this.name = 'TourLoadError';
    this.errors = errors;
  }
}

function asLoadError(error: unknown): TourLoadError {
  if (error instanceof TourLoadError) {
    return error;
  }
  return new TourLoadError('Failed to read tour file', [
    {
      path: '$',
      message: error instanceof Error ? error.message : 'Unknown read error',
      code: 'file-read-error',
    },
  ]);
}

export function parseTour(json: string): Tour {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new TourLoadError('Malformed JSON in tour file', [
      {
        path: '$',
        message: error instanceof Error ? error.message : 'Invalid JSON',
        code: 'invalid-json',
      },
    ]);
  }

  const result = validate(parsed);
  if (!result.success) {
    throw new TourLoadError('Tour validation failed', result.errors);
  }
  return result.tour;
}

export async function loadTour(filePath: string): Promise<Tour> {
  try {
    const json = await readFile(filePath, 'utf8');
    return parseTour(json);
  } catch (error) {
    throw asLoadError(error);
  }
}
