import type { ValidationError } from '@tourguide/format';
import { describe, expect, it } from 'vitest';
import { formatFileResult, formatValidationError } from '../../src/format/errors';

describe('formatValidationError', () => {
  it('formats schema errors with path', () => {
    const error: ValidationError = {
      path: 'steps[2].range.start.line',
      message: 'Expected number, received string',
      code: 'invalid_type',
    };
    const result = formatValidationError(error);
    expect(result).toContain('steps[2].range.start.line');
    expect(result).toContain('Expected number, received string');
  });

  it('formats semantic errors', () => {
    const error: ValidationError = {
      path: 'chapters.chapter-1.steps.step-1.chapter',
      message: 'Unknown chapter reference "missing-chapter"',
      code: 'unknown-chapter-reference',
    };
    const result = formatValidationError(error);
    expect(result).toContain('Unknown chapter reference');
    expect(result).toContain('missing-chapter');
  });

  it('formats file read errors', () => {
    const error: ValidationError = {
      path: '$',
      message: "ENOENT: no such file or directory, open 'missing.tourguide'",
      code: 'file-read-error',
    };
    const result = formatValidationError(error);
    expect(result).toContain('ENOENT');
  });
});

describe('formatFileResult', () => {
  it('formats success with title and counts', () => {
    const result = formatFileResult('tour.tourguide', {
      success: true,
      title: 'My Tour',
      chapterCount: 3,
      stepCount: 12,
    });
    expect(result).toContain('My Tour');
    expect(result).toContain('3 chapters');
    expect(result).toContain('12 steps');
    expect(result).toContain('✓');
  });

  it('formats failure with error list', () => {
    const errors: ValidationError[] = [
      { path: '$.title', message: 'Required', code: 'invalid_type' },
    ];
    const result = formatFileResult('bad.tourguide', { success: false, errors });
    expect(result).toContain('bad.tourguide');
    expect(result).toContain('✗');
    expect(result).toContain('Required');
  });
});
