import { describe, expect, it } from 'vitest';
import { validate } from '../src/validate';

const baseTour = {
  version: '1.0.0',
  title: 'Validation tour',
  description: 'Validation test tour',
  mode: 'diff',
  baseRef: 'main',
  headRef: 'HEAD',
  overview: {
    summary: 'Overview',
    fileMap: [
      {
        file: 'src/a.ts',
        description: 'Primary',
        relevance: 'primary',
      },
    ],
  },
  chapters: [
    {
      id: 'ch-1',
      title: 'Chapter',
      summary: 'Summary',
      steps: [
        {
          id: 'step-1',
          file: 'src/a.ts',
          range: {
            start: { line: 1, character: 0 },
            end: { line: 2, character: 1 },
          },
          title: 'Step',
          description: 'Description',
          kind: 'utility',
          chapter: 'ch-1',
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
        end: { line: 1, character: 3 },
      },
      content: 'Context',
      kind: 'utility',
      category: 'context',
    },
  ],
  connections: [
    {
      from: 'step-1',
      to: 'ann-1',
      type: 'calls',
    },
  ],
};

describe('validate', () => {
  it('returns a typed tour when validation succeeds', () => {
    const result = validate(baseTour);
    expect(result.success).toBe(true);
  });

  it('returns structured schema errors', () => {
    const result = validate({
      ...baseTour,
      title: undefined,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0]).toEqual(
        expect.objectContaining({
          path: expect.any(String),
          message: expect.any(String),
          code: expect.any(String),
        }),
      );
    }
  });

  it('rejects unknown chapter references in steps', () => {
    const result = validate({
      ...baseTour,
      chapters: [
        {
          ...baseTour.chapters[0],
          steps: [
            {
              ...baseTour.chapters[0].steps[0],
              chapter: 'ch-missing',
            },
          ],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown annotation references', () => {
    const result = validate({
      ...baseTour,
      chapters: [
        {
          ...baseTour.chapters[0],
          steps: [
            {
              ...baseTour.chapters[0].steps[0],
              annotationRefs: ['missing-ann'],
            },
          ],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown connection node references', () => {
    const result = validate({
      ...baseTour,
      connections: [
        {
          from: 'step-1',
          to: 'missing-node',
          type: 'calls',
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('adds warning when version is not 1.x', () => {
    const result = validate({
      ...baseTour,
      version: '2.0.0',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'version-mismatch',
          }),
        ]),
      );
    }
  });
});
