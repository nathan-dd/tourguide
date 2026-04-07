import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Tour } from '@tourguide/format';
import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generate, parseDiffRange } from '../src/commands/generate';

vi.mock('@tourguide/generate', () => ({
  createModel: vi.fn(),
  generateTour: vi.fn(),
}));

import { createModel, generateTour } from '@tourguide/generate';

const minimalTour = {
  version: '1.0.0',
  title: 'Test tour',
  description: 'Test',
  mode: 'codebase',
  ref: 'main',
  overview: {
    summary: 'Overview',
    fileMap: [
      {
        file: 'src/file.ts',
        description: 'Primary file',
        relevance: 'primary',
      },
    ],
  },
  chapters: [
    {
      id: 'chapter-1',
      title: 'Chapter 1',
      summary: 'Summary',
      steps: [
        {
          id: 'step-1',
          file: 'src/file.ts',
          range: {
            start: { line: 1, character: 0 },
            end: { line: 2, character: 1 },
          },
          title: 'Step 1',
          description: 'Description',
          kind: 'utility',
          chapter: 'chapter-1',
          connections: [],
          annotationRefs: [],
        },
      ],
    },
  ],
  annotations: [],
  connections: [],
} satisfies Tour;

describe('parseDiffRange', () => {
  it('splits main..HEAD', () => {
    expect(parseDiffRange('main..HEAD')).toEqual({ baseRef: 'main', headRef: 'HEAD' });
  });

  it('splits on first .. only (head may contain dots)', () => {
    expect(parseDiffRange('foo..bar..baz')).toEqual({ baseRef: 'foo', headRef: 'bar..baz' });
  });

  it('rejects range without ..', () => {
    expect(() => parseDiffRange('mainHEAD')).toThrow(/Invalid --diff/);
  });

  it('rejects empty base or head', () => {
    expect(() => parseDiffRange('..HEAD')).toThrow(/non-empty/);
    expect(() => parseDiffRange('HEAD..')).toThrow(/non-empty/);
  });
});

describe('generate command (mocked @tourguide/generate)', () => {
  beforeEach(() => {
    vi.mocked(createModel).mockResolvedValue({} as Awaited<ReturnType<typeof createModel>>);
    vi.mocked(generateTour).mockResolvedValue({ tour: minimalTour, warnings: [] });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 1 when --diff has no ..', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const code = await generate(
        {
          diff: 'mainHEAD',
          model: 'm',
          provider: 'anthropic',
          maxSteps: 25,
          quiet: true,
          packageVersion: '1.0.0',
        },
        process.cwd(),
      );
      expect(code).toBe(1);
      expect(createModel).not.toHaveBeenCalled();
    } finally {
      errSpy.mockRestore();
    }
  });

  it('returns 1 when repo is not git', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tg-cli-'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const code = await generate(
        {
          diff: 'main..HEAD',
          model: 'claude-sonnet-4-6',
          provider: 'anthropic',
          maxSteps: 25,
          quiet: false,
          packageVersion: '9.9.9',
        },
        dir,
      );
      expect(code).toBe(1);
      expect(createModel).not.toHaveBeenCalled();
    } finally {
      errSpy.mockRestore();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('calls createModel and generateTour with expected args', async () => {
    const repoPath = process.cwd();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const code = await generate(
        {
          diff: 'main..HEAD',
          model: 'my-model',
          provider: 'anthropic',
          maxSteps: 7,
          quiet: true,
          packageVersion: '0.1.0',
        },
        repoPath,
      );
      expect(code).toBe(0);
      expect(createModel).toHaveBeenCalledWith('anthropic', 'my-model');
      expect(generateTour).toHaveBeenCalledWith(
        expect.objectContaining({
          repoPath,
          baseRef: 'main',
          headRef: 'HEAD',
          maxSteps: 7,
          modelId: 'my-model',
          packageVersion: '0.1.0',
          onProgress: undefined,
        }),
      );
    } finally {
      logSpy.mockRestore();
    }
  });

  it('writes JSON to --output path', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tg-cli-'));
    const outPath = join(dir, 'out.json');
    try {
      const code = await generate(
        {
          diff: 'a..b',
          model: 'm',
          provider: 'anthropic',
          maxSteps: 25,
          quiet: true,
          packageVersion: '1.0.0',
          output: outPath,
        },
        process.cwd(),
      );
      expect(code).toBe(0);
      const text = await readFile(outPath, 'utf8');
      expect(JSON.parse(text)).toEqual(minimalTour);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('exits 1 with semanticErrors but still produces output', async () => {
    const logs: string[] = [];
    const errs: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((msg) => {
      logs.push(String(msg));
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation((msg) => {
      errs.push(String(msg));
    });
    vi.mocked(generateTour).mockResolvedValue({
      tour: minimalTour,
      warnings: [{ path: '/x', message: 'w', code: 'w1' }],
      semanticErrors: [{ path: '/y', message: 'bad', code: 'e1' }],
    });
    try {
      const code = await generate(
        {
          diff: 'x..y',
          model: 'm',
          provider: 'anthropic',
          maxSteps: 25,
          quiet: true,
          packageVersion: '1.0.0',
        },
        process.cwd(),
      );
      expect(code).toBe(1);
      expect(errs.some((e) => e.includes('Warning:'))).toBe(true);
      expect(errs.some((e) => e.includes('Semantic error:'))).toBe(true);
      expect(JSON.parse(logs[0] ?? '{}')).toEqual(minimalTour);
    } finally {
      logSpy.mockRestore();
      errSpy.mockRestore();
    }
  });
});

describe('generate CLI options (commander)', () => {
  it('requires --diff (mirrors cli.ts generate command)', () => {
    const program = new Command();
    program
      .exitOverride()
      .configureOutput({ writeErr: () => {} })
      .command('generate')
      .requiredOption('--diff <range>', 'Git ref range (e.g., main..HEAD)')
      .action(() => {});

    expect(() => {
      program.parse(['generate'], { from: 'user' });
    }).toThrow();
  });
});
