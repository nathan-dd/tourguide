import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseTour } from '../src/loader';
import {
  firstPosition,
  getChapter,
  getProgress,
  getStep,
  lastPosition,
  nextChapter,
  nextStep,
  prevChapter,
  prevStep,
} from '../src/traversal';

const sampleTour = parseTour(
  readFileSync(resolve(process.cwd(), 'tests/fixtures/sample.tourguide'), 'utf8'),
);

describe('traversal', () => {
  it('returns first and last positions', () => {
    expect(firstPosition(sampleTour)).toEqual({ chapterIndex: 0, stepIndex: 0 });
    expect(lastPosition(sampleTour)).toEqual({ chapterIndex: 1, stepIndex: 0 });
  });

  it('advances and retreats across chapter boundaries', () => {
    const start = firstPosition(sampleTour);
    const second = nextStep(sampleTour, start);
    expect(second).toEqual({ chapterIndex: 1, stepIndex: 0 });
    expect(prevStep(sampleTour, second)).toEqual(start);
  });

  it('jumps by chapter', () => {
    const start = firstPosition(sampleTour);
    const next = nextChapter(sampleTour, start);
    expect(next).toEqual({ chapterIndex: 1, stepIndex: 0 });
    expect(prevChapter(sampleTour, next)).toEqual(start);
  });

  it('returns null at boundaries', () => {
    const start = firstPosition(sampleTour);
    const end = lastPosition(sampleTour);
    expect(prevStep(sampleTour, start)).toBeNull();
    expect(nextStep(sampleTour, end)).toBeNull();
  });

  it('returns current chapter, step and progress', () => {
    const pos = firstPosition(sampleTour);
    expect(getChapter(sampleTour, pos).id).toBe('chapter-1');
    expect(getStep(sampleTour, pos).id).toBe('step-1');
    expect(getProgress(sampleTour, pos)).toEqual({
      chapter: { current: 1, total: 2 },
      chapterStep: { current: 1, total: 1 },
      overallStep: { current: 1, total: 2 },
    });
  });
});
