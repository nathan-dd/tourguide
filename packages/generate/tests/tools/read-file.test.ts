import { afterEach, describe, expect, it } from 'vitest';
import { cleanupFixtureRepo, createFixtureRepo } from '../helpers/fixture-repo.js';

const GIT_OBJECT_ID = /^[0-9a-f]{40}$/i;

describe('fixture repo (smoke)', () => {
  let repoPath: string | undefined;

  afterEach(async () => {
    if (repoPath) {
      await cleanupFixtureRepo(repoPath);
      repoPath = undefined;
    }
  });

  it('creates a repo with two commits and valid object ids', async () => {
    const fixture = await createFixtureRepo();
    repoPath = fixture.repoPath;

    expect(fixture.baseRef).toMatch(GIT_OBJECT_ID);
    expect(fixture.headRef).toMatch(GIT_OBJECT_ID);
    expect(fixture.baseRef).not.toBe(fixture.headRef);
  });
});
