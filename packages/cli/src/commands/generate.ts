import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import type { ValidationError, ValidationWarning } from '@tourguide/format';
import type { StepDetail } from '@tourguide/generate';
import { createModel, generateTour } from '@tourguide/generate';

const execFileAsync = promisify(execFile);

export type GenerateCommandOptions = {
  diff: string;
  model: string;
  provider: string;
  maxSteps: number;
  quiet: boolean;
  verbose: boolean;
  /** From `packages/cli/package.json` (see cli.ts createRequire). */
  packageVersion: string;
  output?: string;
};

/**
 * Split a git ref range on the first `..` (e.g. `main..HEAD`, `a..b..c` → head `b..c`).
 */
export function parseDiffRange(range: string): { baseRef: string; headRef: string } {
  const idx = range.indexOf('..');
  if (idx === -1) {
    throw new Error('Invalid --diff: expected base..head (e.g. main..HEAD)');
  }
  const baseRef = range.slice(0, idx);
  const headRef = range.slice(idx + 2);
  if (!baseRef.trim() || !headRef.trim()) {
    throw new Error('Invalid --diff: base and head refs must be non-empty');
  }
  return { baseRef, headRef };
}

async function assertGitRepo(repoPath: string): Promise<void> {
  try {
    await execFileAsync('git', ['-C', repoPath, 'rev-parse', '--git-dir'], {
      encoding: 'utf8',
    });
  } catch {
    throw new Error(`Not a git repository: ${repoPath}`);
  }
}

function formatIssues(label: string, items: ValidationWarning[] | ValidationError[]): string {
  return items.map((w) => `${label}: ${w.path}: ${w.message} (${w.code})`).join('\n');
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

function formatStepDetail(detail: StepDetail): string {
  const lines: string[] = [];
  const header = `[${detail.phase} step ${detail.stepNumber}]`;

  for (const tc of detail.toolCalls) {
    lines.push(`${header} tool_call: ${tc.toolName}(${truncate(JSON.stringify(tc.args), 200)})`);
  }
  for (const tr of detail.toolResults) {
    lines.push(`${header} tool_result: ${tr.toolName} → ${truncate(tr.result, 300)}`);
  }
  if (detail.text) {
    lines.push(`${header} text: ${truncate(detail.text, 500)}`);
  }
  return lines.join('\n');
}

/**
 * Runs tour generation; prints JSON to stdout or `--output`. Returns exit code (1 on semantic errors or failure).
 */
export async function generate(
  opts: GenerateCommandOptions,
  repoPath: string = process.cwd(),
): Promise<number> {
  let baseRef: string;
  let headRef: string;
  try {
    ({ baseRef, headRef } = parseDiffRange(opts.diff));
    await assertGitRepo(repoPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(message);
    return 1;
  }

  const onProgress =
    opts.quiet === true
      ? undefined
      : (message: string, detail?: { step?: number; maxSteps?: number }) => {
          const suffix =
            detail?.step !== undefined && detail?.maxSteps !== undefined
              ? ` (${detail.step}/${detail.maxSteps})`
              : '';
          console.error(`${message}${suffix}`);
        };

  try {
    const onStepDetail =
      opts.verbose === true
        ? (detail: StepDetail) => {
            const formatted = formatStepDetail(detail);
            if (formatted) console.error(formatted);
          }
        : undefined;

    const model = await createModel(opts.provider, opts.model);
    const result = await generateTour({
      repoPath,
      baseRef,
      headRef,
      model,
      maxSteps: opts.maxSteps,
      onProgress,
      onStepDetail,
      modelId: opts.model,
      packageVersion: opts.packageVersion,
    });

    if (result.warnings.length > 0) {
      console.error(formatIssues('Warning', result.warnings));
    }
    if (result.semanticErrors !== undefined && result.semanticErrors.length > 0) {
      console.error(formatIssues('Semantic error', result.semanticErrors));
    }

    const json = JSON.stringify(result.tour, null, 2);
    if (opts.output !== undefined) {
      await writeFile(opts.output, `${json}\n`, 'utf8');
    } else {
      console.log(json);
    }

    return result.semanticErrors !== undefined && result.semanticErrors.length > 0 ? 1 : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(message);
    return 1;
  }
}
