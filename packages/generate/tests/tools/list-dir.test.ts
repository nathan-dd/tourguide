import { afterEach, describe, expect, it } from 'vitest';
import { executeListDirectory } from '../../src/tools/list-dir.js';
import { cleanupFixtureRepo, createFixtureRepo } from '../helpers/fixture-repo.js';

function lines(out: string): string[] {
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

describe('executeListDirectory', () => {
  let repoPath: string | undefined;

  afterEach(async () => {
    if (repoPath) {
      await cleanupFixtureRepo(repoPath);
      repoPath = undefined;
    }
  });

  it('lists repository root at baseRef', async () => {
    const { repoPath: path, baseRef } = await createFixtureRepo();
    repoPath = path;

    const out = await executeListDirectory({ ref: baseRef }, path);
    const names = lines(out);

    expect(names).toContain('README.md');
    expect(names).toContain('src');
  });

  it('lists entries under src at baseRef', async () => {
    const { repoPath: path, baseRef } = await createFixtureRepo();
    repoPath = path;

    const out = await executeListDirectory({ ref: baseRef, dirPath: 'src' }, path);
    const names = lines(out);

    expect(names).toEqual(expect.arrayContaining(['src/math.ts', 'src/utils.ts']));
    expect(names).not.toContain('src/api.ts');
  });

  it('includes api.ts under src at headRef', async () => {
    const { repoPath: path, headRef } = await createFixtureRepo();
    repoPath = path;

    const out = await executeListDirectory({ ref: headRef, dirPath: 'src' }, path);
    const names = lines(out);

    expect(names).toContain('src/api.ts');
  });
});
