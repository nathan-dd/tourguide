import { validate } from '@tourguide/format';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateTour } from '../src/generate';
import { createModel } from '../src/provider';
import { cleanupFixtureRepo, createFixtureRepo } from './helpers/fixture-repo';

const FIXTURE_RELATIVE_PATHS = new Set(['README.md', 'src/api.ts', 'src/math.ts', 'src/utils.ts']);

function normalizeRepoPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '');
}

describe.runIf(process.env.TOURGUIDE_TEST_LLM === '1')('generateTour (LLM integration)', () => {
  let repoPath: string | undefined;

  beforeAll(() => {
    if (!process.env.ANTHROPIC_API_KEY?.trim()) {
      throw new Error(
        'TOURGUIDE_TEST_LLM=1 requires ANTHROPIC_API_KEY in the environment. Set the key to run this suite.',
      );
    }
  });

  afterAll(async () => {
    if (repoPath) {
      await cleanupFixtureRepo(repoPath);
    }
  });

  it('generates a diff tour from a real fixture repo', async () => {
    const fixture = await createFixtureRepo();
    repoPath = fixture.repoPath;
    const { baseRef, headRef } = fixture;

    const modelId = process.env.TOURGUIDE_TEST_MODEL ?? 'claude-sonnet-4-6';
    const model = await createModel('anthropic', modelId);

    const result = await generateTour({
      repoPath,
      baseRef,
      headRef,
      model,
      modelId,
      packageVersion: '0.0.0-integration',
      maxSteps: 15,
    });

    const validation = validate(result.tour);
    const stepFiles = result.tour.chapters.flatMap((ch) =>
      ch.steps.map((s) => normalizeRepoPath(s.file)),
    );
    const totalSteps = stepFiles.length;
    const stepsReferenceFixture =
      totalSteps > 0 && stepFiles.every((f) => FIXTURE_RELATIVE_PATHS.has(f));

    const meetsMinimum =
      result.tour.mode === 'diff' && result.tour.chapters.length >= 1 && stepsReferenceFixture;

    expect(
      validation.success || meetsMinimum,
      !validation.success && !meetsMinimum
        ? `Tour failed validation and minimum bar: errors=${JSON.stringify(
            validation.success ? [] : validation.errors,
          )} stepFiles=${JSON.stringify(stepFiles)}`
        : undefined,
    ).toBe(true);

    if (result.tour.mode === 'diff') {
      expect(result.tour.baseRef).toBe(baseRef);
      expect(result.tour.headRef).toBe(headRef);
    }
  });
});
