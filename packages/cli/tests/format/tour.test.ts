import type { TourProgress } from '@tourguide/core';
import type { Chapter, Step, Tour } from '@tourguide/format';
import { describe, expect, it } from 'vitest';
import { formatCodeBlock } from '../../src/format/code';
import { formatChapterTransition, formatStepDisplay, formatSummary } from '../../src/format/tour';

describe('formatCodeBlock', () => {
  it('formats code with line numbers in a box', () => {
    const code = 'function hello() {\n  return "world";\n}';
    const result = formatCodeBlock(code, 10);
    expect(result).toContain('10');
    expect(result).toContain('12');
    expect(result).toContain('function hello()');
    expect(result).toContain('┌');
    expect(result).toContain('└');
    expect(result).toContain('│');
  });

  it('pads line numbers to consistent width', () => {
    const code = Array.from({ length: 5 }, (_, i) => `line ${i}`).join('\n');
    const result = formatCodeBlock(code, 98);
    expect(result).toContain(' 98');
    expect(result).toContain('100');
    expect(result).toContain('102');
  });
});

describe('formatStepDisplay', () => {
  it('includes progress, title, file path, and description', () => {
    const progress: TourProgress = {
      chapter: { current: 2, total: 4 },
      chapterStep: { current: 3, total: 5 },
      overallStep: { current: 8, total: 12 },
    };
    const chapter: Chapter = {
      id: 'ch-2',
      title: 'Data Validation',
      summary: 'S',
      steps: [],
    };
    const step: Step = {
      id: 's-3',
      file: 'src/validation.ts',
      range: { start: { line: 15, character: 0 }, end: { line: 42, character: 0 } },
      title: 'Validate Input',
      description: 'This validates user input.',
      kind: 'utility',
      chapter: 'ch-2',
      connections: [],
      annotationRefs: [],
    };
    const result = formatStepDisplay(progress, chapter, step, null);
    expect(result).toContain('Chapter 2/4');
    expect(result).toContain('Data Validation');
    expect(result).toContain('Step 8/12');
    expect(result).toContain('Validate Input');
    expect(result).toContain('src/validation.ts:15-42');
    expect(result).toContain('This validates user input.');
  });

  it('includes code block when provided', () => {
    const progress: TourProgress = {
      chapter: { current: 1, total: 1 },
      chapterStep: { current: 1, total: 1 },
      overallStep: { current: 1, total: 1 },
    };
    const chapter: Chapter = { id: 'ch', title: 'Ch', summary: 'S', steps: [] };
    const step: Step = {
      id: 's',
      file: 'a.ts',
      range: { start: { line: 1, character: 0 }, end: { line: 3, character: 0 } },
      title: 'T',
      description: 'D',
      kind: 'utility',
      chapter: 'ch',
      connections: [],
      annotationRefs: [],
    };
    const result = formatStepDisplay(progress, chapter, step, 'const x = 1;\nconst y = 2;');
    expect(result).toContain('const x = 1');
    expect(result).toContain('┌');
  });
});

describe('formatChapterTransition', () => {
  it('includes chapter title and summary', () => {
    const chapter: Chapter = {
      id: 'ch-3',
      title: 'Error Handling',
      summary: 'Building resilient error boundaries',
      steps: [],
    };
    const result = formatChapterTransition(chapter, 3, 5);
    expect(result).toContain('Chapter 3/5');
    expect(result).toContain('Error Handling');
    expect(result).toContain('Building resilient error boundaries');
    expect(result).toContain('━');
  });
});

describe('formatSummary', () => {
  it('includes title, mode, chapters, and file map', () => {
    const tour = {
      version: '1.0.0',
      title: 'My Tour',
      description: 'A tour description',
      mode: 'codebase',
      ref: 'main',
      overview: {
        summary: 'This tour explains things.',
        fileMap: [
          { file: 'src/a.ts', description: 'Main file', relevance: 'primary' },
          { file: 'src/b.ts', description: 'Helper', relevance: 'secondary' },
        ],
      },
      chapters: [
        {
          id: 'ch-1',
          title: 'Setup',
          summary: 'Initial setup',
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
            {
              id: 's-2',
              file: 'a.ts',
              range: { start: { line: 3, character: 0 }, end: { line: 4, character: 0 } },
              title: 'S2',
              description: 'D',
              kind: 'utility',
              chapter: 'ch-1',
              connections: [],
              annotationRefs: [],
            },
          ],
        },
        {
          id: 'ch-2',
          title: 'Core',
          summary: 'Core logic',
          steps: [
            {
              id: 's-3',
              file: 'b.ts',
              range: { start: { line: 1, character: 0 }, end: { line: 2, character: 0 } },
              title: 'S3',
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
    const result = formatSummary(tour);
    expect(result).toContain('My Tour');
    expect(result).toContain('A tour description');
    expect(result).toContain('codebase');
    expect(result).toContain('This tour explains things.');
    expect(result).toContain('Setup');
    expect(result).toContain('2 steps');
    expect(result).toContain('Core');
    expect(result).toContain('1 step');
    expect(result).toContain('src/a.ts');
    expect(result).toContain('primary');
    expect(result).toContain('src/b.ts');
  });
});
