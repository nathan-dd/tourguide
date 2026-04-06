import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Tour } from '@tourguide/format';
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
  totalSteps,
} from '../src/traversal';

const sampleTour = parseTour(
  readFileSync(resolve(process.cwd(), 'tests/fixtures/sample.tourguide'), 'utf8'),
);

const emptyTour: Tour = {
  version: '1.0.0',
  title: 'Empty',
  description: 'No chapters',
  mode: 'codebase',
  ref: 'main',
  overview: { summary: 'Empty', fileMap: [] },
  chapters: [],
  annotations: [],
  connections: [],
} as Tour;

const tourWithEmptyChapters: Tour = {
  version: '1.0.0',
  title: 'Gaps',
  description: 'Has empty chapters',
  mode: 'codebase',
  ref: 'main',
  overview: { summary: 'Test', fileMap: [] },
  chapters: [
    { id: 'empty-1', title: 'Empty first', summary: 'S', steps: [] },
    {
      id: 'ch-1',
      title: 'Has steps',
      summary: 'S',
      steps: [
        {
          id: 's-1',
          file: 'a.ts',
          range: { start: { line: 1, character: 0 }, end: { line: 2, character: 0 } },
          title: 'S1',
          description: 'D',
          kind: 'utility',
          chapter: 'ch-1',
          connections: [],
          annotationRefs: [],
        },
      ],
    },
    { id: 'empty-2', title: 'Empty mid', summary: 'S', steps: [] },
    {
      id: 'ch-2',
      title: 'Also has steps',
      summary: 'S',
      steps: [
        {
          id: 's-2',
          file: 'b.ts',
          range: { start: { line: 1, character: 0 }, end: { line: 2, character: 0 } },
          title: 'S2',
          description: 'D',
          kind: 'utility',
          chapter: 'ch-2',
          connections: [],
          annotationRefs: [],
        },
      ],
    },
  ],
  annotations: [],
  connections: [],
} as Tour;

describe('traversal', () => {
  it('returns first and last positions', () => {
    expect(firstPosition(sampleTour)).toEqual({ chapterIndex: 0, stepIndex: 0 });
    expect(lastPosition(sampleTour)).toEqual({ chapterIndex: 1, stepIndex: 0 });
  });

  it('advances and retreats across chapter boundaries', () => {
    const maybeStart = firstPosition(sampleTour);
    expect(maybeStart).not.toBeNull();
    if (!maybeStart) {
      return;
    }
    const start = maybeStart;
    const second = nextStep(sampleTour, start);
    expect(second).toEqual({ chapterIndex: 1, stepIndex: 0 });
    expect(second).not.toBeNull();
    if (!second) {
      return;
    }
    expect(prevStep(sampleTour, second)).toEqual(start);
  });

  it('jumps by chapter', () => {
    const maybeStart = firstPosition(sampleTour);
    expect(maybeStart).not.toBeNull();
    if (!maybeStart) {
      return;
    }
    const start = maybeStart;
    const next = nextChapter(sampleTour, start);
    expect(next).toEqual({ chapterIndex: 1, stepIndex: 0 });
    expect(next).not.toBeNull();
    if (!next) {
      return;
    }
    expect(prevChapter(sampleTour, next)).toEqual(start);
  });

  it('returns null at boundaries', () => {
    const maybeStart = firstPosition(sampleTour);
    const maybeEnd = lastPosition(sampleTour);
    expect(maybeStart).not.toBeNull();
    expect(maybeEnd).not.toBeNull();
    if (!maybeStart || !maybeEnd) {
      return;
    }
    const start = maybeStart;
    const end = maybeEnd;
    expect(prevStep(sampleTour, start)).toBeNull();
    expect(nextStep(sampleTour, end)).toBeNull();
  });

  it('returns current chapter, step and progress', () => {
    const maybePos = firstPosition(sampleTour);
    expect(maybePos).not.toBeNull();
    if (!maybePos) {
      return;
    }
    const pos = maybePos;
    expect(getChapter(sampleTour, pos).id).toBe('chapter-1');
    expect(getStep(sampleTour, pos).id).toBe('step-1');
    expect(getProgress(sampleTour, pos)).toEqual({
      chapter: { current: 1, total: 2 },
      chapterStep: { current: 1, total: 1 },
      overallStep: { current: 1, total: 2 },
    });
  });
});

describe('traversal — empty tours', () => {
  it('returns null for first/last position in empty tour', () => {
    expect(firstPosition(emptyTour)).toBeNull();
    expect(lastPosition(emptyTour)).toBeNull();
  });

  it('returns zero total steps for empty tour', () => {
    expect(totalSteps(emptyTour)).toBe(0);
  });

  it('returns 0/0 progress for null position', () => {
    const progress = getProgress(emptyTour, null);
    expect(progress.chapter).toEqual({ current: 0, total: 0 });
    expect(progress.overallStep).toEqual({ current: 0, total: 0 });
  });
});

describe('traversal — empty chapters', () => {
  it('skips empty first chapter in firstPosition', () => {
    const pos = firstPosition(tourWithEmptyChapters);
    expect(pos).toEqual({ chapterIndex: 1, stepIndex: 0 });
  });

  it('skips empty last chapter in lastPosition', () => {
    const pos = lastPosition(tourWithEmptyChapters);
    expect(pos).toEqual({ chapterIndex: 3, stepIndex: 0 });
  });

  it('nextChapter skips empty chapters', () => {
    const maybeStart = firstPosition(tourWithEmptyChapters);
    expect(maybeStart).not.toBeNull();
    if (!maybeStart) {
      return;
    }
    const start = maybeStart;
    const next = nextChapter(tourWithEmptyChapters, start);
    expect(next).toEqual({ chapterIndex: 3, stepIndex: 0 });
  });

  it('prevChapter skips empty chapters', () => {
    const maybeEnd = lastPosition(tourWithEmptyChapters);
    expect(maybeEnd).not.toBeNull();
    if (!maybeEnd) {
      return;
    }
    const end = maybeEnd;
    const prev = prevChapter(tourWithEmptyChapters, end);
    expect(prev).toEqual({ chapterIndex: 1, stepIndex: 0 });
  });

  it('nextStep crosses empty chapters', () => {
    const maybeStart = firstPosition(tourWithEmptyChapters);
    expect(maybeStart).not.toBeNull();
    if (!maybeStart) {
      return;
    }
    const start = maybeStart;
    const next = nextStep(tourWithEmptyChapters, start);
    expect(next).toEqual({ chapterIndex: 3, stepIndex: 0 });
  });
});
