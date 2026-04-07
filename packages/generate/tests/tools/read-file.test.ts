import { afterEach, describe, expect, it } from 'vitest';
import { executeReadFileAtRef } from '../../src/tools/read-file.js';
import { cleanupFixtureRepo, createFixtureRepo } from '../helpers/fixture-repo.js';

describe('executeReadFileAtRef', () => {
  let repoPath: string | undefined;

  afterEach(async () => {
    if (repoPath) {
      await cleanupFixtureRepo(repoPath);
      repoPath = undefined;
    }
  });

  it('reads an existing file at baseRef', async () => {
    const { repoPath: path, baseRef } = await createFixtureRepo();
    repoPath = path;

    const content = await executeReadFileAtRef({ ref: baseRef, filePath: 'src/math.ts' }, path);

    expect(content).toContain('export function add');
    expect(content).not.toContain('multiply');
  });

  it('reads api.ts at headRef but not at baseRef', async () => {
    const { repoPath: path, baseRef, headRef } = await createFixtureRepo();
    repoPath = path;

    await expect(
      executeReadFileAtRef({ ref: baseRef, filePath: 'src/api.ts' }, path),
    ).rejects.toThrow(/No file at src\/api\.ts/);

    const atHead = await executeReadFileAtRef({ ref: headRef, filePath: 'src/api.ts' }, path);
    expect(atHead).toContain('demo');
    expect(atHead).toContain('multiply');
  });

  it('throws for a nonexistent path', async () => {
    const { repoPath: path, headRef } = await createFixtureRepo();
    repoPath = path;

    await expect(
      executeReadFileAtRef({ ref: headRef, filePath: 'src/does-not-exist.ts' }, path),
    ).rejects.toThrow(/No file at src\/does-not-exist\.ts/);
  });
});
