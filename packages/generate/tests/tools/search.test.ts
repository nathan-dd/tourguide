import { afterEach, describe, expect, it } from 'vitest';
import { executeSearchCodebase } from '../../src/tools/search.js';
import { cleanupFixtureRepo, createFixtureRepo } from '../helpers/fixture-repo.js';

describe('executeSearchCodebase', () => {
  let repoPath: string | undefined;

  afterEach(async () => {
    if (repoPath) {
      await cleanupFixtureRepo(repoPath);
      repoPath = undefined;
    }
  });

  it('finds matches for add', async () => {
    const { repoPath: path } = await createFixtureRepo();
    repoPath = path;

    const out = await executeSearchCodebase({ pattern: 'add' }, path);
    expect(out).toContain('add');
    expect(out).toMatch(/\d+:/);
  });

  it('finds matches for multiply at head', async () => {
    const { repoPath: path } = await createFixtureRepo();
    repoPath = path;

    const out = await executeSearchCodebase({ pattern: 'multiply' }, path);
    expect(out).toContain('multiply');
  });

  it('returns empty string when nothing matches', async () => {
    const { repoPath: path } = await createFixtureRepo();
    repoPath = path;

    const out = await executeSearchCodebase({ pattern: 'zzzznonexistentpattern999' }, path);
    expect(out).toBe('');
  });

  it('respects glob filter', async () => {
    const { repoPath: path } = await createFixtureRepo();
    repoPath = path;

    const scoped = await executeSearchCodebase({ pattern: 'demo', glob: '**/api.ts' }, path);
    expect(scoped).toContain('api.ts');
    expect(scoped).not.toContain('utils.ts');

    const utilsOnly = await executeSearchCodebase({ pattern: 'greet', glob: '**/utils.ts' }, path);
    expect(utilsOnly).toContain('utils.ts');
    expect(utilsOnly).not.toContain('api.ts');
  });
});
