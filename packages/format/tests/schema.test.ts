import { describe, expect, it } from 'vitest';
import { tourSchema } from '../src/schema';

const validDiffTour = {
  $schema: 'https://tourguide.dev/schema/tourguide.schema.json',
  version: '1.0.0',
  title: 'Diff tour',
  description: 'A test diff tour',
  mode: 'diff',
  baseRef: 'main',
  headRef: 'HEAD',
  overview: {
    summary: 'Overview',
    fileMap: [
      {
        file: 'src/a.ts',
        description: 'Primary file',
        relevance: 'primary',
      },
    ],
  },
  chapters: [
    {
      id: 'chapter-1',
      title: 'Routing',
      summary: 'Request routing',
      steps: [
        {
          id: 'step-1',
          file: 'src/a.ts',
          range: {
            start: { line: 1, character: 0 },
            end: { line: 5, character: 1 },
          },
          title: 'Entry',
          description: 'Entry point',
          kind: 'entry-point',
          chapter: 'chapter-1',
          connections: [],
          annotationRefs: ['ann-1'],
        },
      ],
    },
  ],
  annotations: [
    {
      id: 'ann-1',
      file: 'src/a.ts',
      range: {
        start: { line: 1, character: 0 },
        end: { line: 1, character: 5 },
      },
      content: 'Important line',
      kind: 'utility',
      category: 'context',
    },
  ],
  connections: [
    {
      from: 'step-1',
      to: 'ann-1',
      type: 'returns-to',
    },
  ],
};

describe('tourSchema', () => {
  it('parses a valid diff tour', () => {
    const result = tourSchema.parse(validDiffTour);
    expect(result.mode).toBe('diff');
    expect(result.baseRef).toBe('main');
    expect(result.headRef).toBe('HEAD');
  });

  it('parses a valid codebase tour', () => {
    const input = {
      ...validDiffTour,
      mode: 'codebase',
      ref: 'main',
      baseRef: undefined,
      headRef: undefined,
    };
    const result = tourSchema.parse(input);
    expect(result.mode).toBe('codebase');
    expect(result.ref).toBe('main');
  });

  it('rejects invalid connection type', () => {
    const input = {
      ...validDiffTour,
      connections: [
        {
          from: 'step-1',
          to: 'ann-1',
          type: 'invalid-type',
        },
      ],
    };
    const result = tourSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects invalid step kind', () => {
    const input = {
      ...validDiffTour,
      chapters: [
        {
          ...validDiffTour.chapters[0],
          steps: [
            {
              ...validDiffTour.chapters[0].steps[0],
              kind: 'bad-kind',
            },
          ],
        },
      ],
    };
    const result = tourSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects missing required top-level fields', () => {
    const input = {
      ...validDiffTour,
      title: undefined,
    };
    const result = tourSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});
