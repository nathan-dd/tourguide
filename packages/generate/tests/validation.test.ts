import { MockLanguageModelV3 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { runNarration } from '../src/narration';
import { runNarrationWithRetry, validateTour } from '../src/validation';

const validDiffTour = {
  version: '1.0.0',
  title: 'Validation tour',
  description: 'Validation test tour',
  mode: 'diff' as const,
  baseRef: 'main',
  headRef: 'HEAD',
  overview: {
    summary: 'Overview',
    fileMap: [
      {
        file: 'src/a.ts',
        description: 'Primary',
        relevance: 'primary' as const,
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
          kind: 'utility' as const,
          chapter: 'ch-1',
          connections: [] as const,
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
      kind: 'utility' as const,
      category: 'context' as const,
    },
  ],
  connections: [
    {
      from: 'step-1',
      to: 'ann-1',
      type: 'calls' as const,
    },
  ],
};

const invalidChapterRefTour = {
  ...validDiffTour,
  chapters: [
    {
      ...validDiffTour.chapters[0],
      steps: [
        {
          ...validDiffTour.chapters[0].steps[0],
          chapter: 'no-such-chapter',
        },
      ],
    },
  ],
};

function mockGenerateResult(text: string) {
  return {
    content: [{ type: 'text' as const, text }],
    finishReason: { unified: 'stop' as const, raw: undefined },
    usage: {
      inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: 1, text: 1, reasoning: undefined },
    },
    warnings: [] as const,
  };
}

describe('validateTour', () => {
  it('accepts a structurally valid tour', () => {
    const result = validateTour(validDiffTour);
    expect(result.success).toBe(true);
  });

  it('rejects a tour with an invalid chapter reference', () => {
    const result = validateTour(invalidChapterRefTour);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.code === 'unknown-chapter-reference')).toBe(true);
    }
  });
});

describe('runNarrationWithRetry', () => {
  it('passes validation errors into the second narration prompt', async () => {
    let callIndex = 0;
    const model = new MockLanguageModelV3({
      doGenerate: async () => {
        callIndex += 1;
        const payload =
          callIndex === 1 ? JSON.stringify(invalidChapterRefTour) : JSON.stringify(validDiffTour);
        return mockGenerateResult(payload);
      },
    });

    const out = await runNarrationWithRetry({
      model,
      synthesis: 'synth',
      diff: 'diff --git a/x b/x\n',
      baseRef: 'main',
      headRef: 'feature',
      modelId: 'mock',
      packageVersion: '0.0.0',
    });

    expect(model.doGenerateCalls.length).toBe(2);
    const secondSerialized = JSON.stringify(model.doGenerateCalls[1]);
    expect(secondSerialized).toContain('Previous output had semantic errors:');
    expect(secondSerialized).toContain('unknown-chapter-reference');
    expect(out.semanticErrors).toBeUndefined();
    expect(validateTour(out.tour).success).toBe(true);
  });

  it('returns semanticErrors after retry when the tour is still invalid', async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () => mockGenerateResult(JSON.stringify(invalidChapterRefTour)),
    });

    const out = await runNarrationWithRetry({
      model,
      synthesis: 'synth',
      diff: 'diff --git a/x b/x\n',
      baseRef: 'main',
      headRef: 'feature',
      modelId: 'mock',
      packageVersion: '0.0.0',
    });

    expect(out.semanticErrors).toBeDefined();
    expect(out.semanticErrors?.length).toBeGreaterThan(0);
    expect(validateTour(out.tour).success).toBe(false);
  });
});

describe('runNarration promptAppend', () => {
  it('includes appended text in the model prompt', async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () => mockGenerateResult(JSON.stringify(validDiffTour)),
    });

    await runNarration({
      model,
      synthesis: 's',
      diff: 'd',
      baseRef: 'a',
      headRef: 'b',
      modelId: 'm',
      packageVersion: '1',
      promptAppend: 'CUSTOM_RETRY_TAIL',
    });

    expect(JSON.stringify(model.doGenerateCalls[0])).toContain('CUSTOM_RETRY_TAIL');
  });
});
