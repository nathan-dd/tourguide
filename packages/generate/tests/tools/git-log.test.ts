import { afterEach, describe, expect, it } from 'vitest';
import { executeGitLog } from '../../src/tools/git-log.js';
import { cleanupFixtureRepo, createFixtureRepo } from '../helpers/fixture-repo.js';

function logLines(out: string): string[] {
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

describe('executeGitLog', () => {
  let repoPath: string | undefined;

  afterEach(async () => {
    if (repoPath) {
      await cleanupFixtureRepo(repoPath);
      repoPath = undefined;
    }
  });

  it('full repo log shows both commits', async () => {
    const { repoPath: path } = await createFixtureRepo();
    repoPath = path;

    const out = await executeGitLog({}, path);
    expect(out).toContain('commit2: extend math, add api');
    expect(out).toContain('commit1: initial');
  });

  it('file-scoped log only includes commits touching that file', async () => {
    const { repoPath: path } = await createFixtureRepo();
    repoPath = path;

    const scoped = await executeGitLog({ filePath: 'src/utils.ts' }, path);
    expect(scoped).toContain('commit1: initial');
    expect(scoped).not.toContain('commit2: extend math, add api');
  });

  it('respects maxEntries', async () => {
    const { repoPath: path } = await createFixtureRepo();
    repoPath = path;

    const out = await executeGitLog({ maxEntries: 1 }, path);
    expect(logLines(out)).toHaveLength(1);
  });
});
