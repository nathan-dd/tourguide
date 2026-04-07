import { afterEach, describe, expect, it } from 'vitest';
import { createTools } from '../../src/tools/index.js';
import { cleanupFixtureRepo, createFixtureRepo } from '../helpers/fixture-repo.js';

const toolCallOptions = { toolCallId: 'test-call', messages: [] as const };

describe('createTools', () => {
  let repoPath: string | undefined;

  afterEach(async () => {
    if (repoPath) {
      await cleanupFixtureRepo(repoPath);
      repoPath = undefined;
    }
  });

  it('wires readFileAtRef execute to the fixture repo', async () => {
    const { repoPath: path, baseRef } = await createFixtureRepo();
    repoPath = path;

    const tools = createTools(path);
    const execute = tools.readFileAtRef.execute;
    expect(execute).toBeDefined();
    if (execute === undefined) {
      throw new Error('expected readFileAtRef.execute');
    }

    const content = await execute({ ref: baseRef, filePath: 'src/math.ts' }, toolCallOptions);

    expect(content).toContain('export function add');
    expect(content).not.toContain('multiply');
  });
});
