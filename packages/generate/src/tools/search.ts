import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DEFAULT_MAX_BUFFER = 10 * 1024 * 1024;

export async function executeSearchCodebase(
  params: { pattern: string; glob?: string },
  repoPath: string,
): Promise<string> {
  const args: string[] = ['--no-heading', '--line-number'];
  if (params.glob !== undefined && params.glob !== '') {
    args.push('--glob', params.glob);
  }
  args.push(params.pattern, '.');

  try {
    const { stdout } = await execFileAsync('rg', args, {
      cwd: repoPath,
      maxBuffer: DEFAULT_MAX_BUFFER,
      encoding: 'utf8',
    });
    return stdout;
  } catch (caught: unknown) {
    const err = caught as { code?: number; status?: number; stderr?: string };
    const code = err.code ?? err.status;
    if (code === 1) {
      return '';
    }
    throw caught;
  }
}
