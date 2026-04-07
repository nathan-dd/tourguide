import { afterEach, describe, expect, it } from 'vitest';
import { executeGitBlame } from '../../src/tools/git-blame.js';
import { cleanupFixtureRepo, createFixtureRepo } from '../helpers/fixture-repo.js';

describe('executeGitBlame', () => {
  let repoPath: string | undefined;

  afterEach(async () => {
    if (repoPath) {
      await cleanupFixtureRepo(repoPath);
      repoPath = undefined;
    }
  });

  it('blames a known file at HEAD', async () => {
    const { repoPath: path } = await createFixtureRepo();
    repoPath = path;

    const out = await executeGitBlame({ filePath: 'src/math.ts' }, path);
    expect(out).toContain('export function add');
    expect(out.length).toBeGreaterThan(0);
  });

  it('blames a line range', async () => {
    const { repoPath: path } = await createFixtureRepo();
    repoPath = path;

    const full = await executeGitBlame({ filePath: 'src/math.ts' }, path);
    const ranged = await executeGitBlame(
      { filePath: 'src/math.ts', startLine: 1, endLine: 2 },
      path,
    );
    expect(ranged.length).toBeLessThan(full.length);
    expect(ranged).toMatch(/export function add/);
  });

  it('throws for a nonexistent file', async () => {
    const { repoPath: path } = await createFixtureRepo();
    repoPath = path;

    await expect(executeGitBlame({ filePath: 'src/does-not-exist.ts' }, path)).rejects.toThrow(
      /Cannot blame src\/does-not-exist\.ts/,
    );
  });
});
