import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DEFAULT_MAX_BUFFER = 10 * 1024 * 1024;

export type ExecGitOptions = {
  maxBuffer?: number;
};

export async function execGit(
  args: string[],
  cwd: string,
  options: ExecGitOptions = {},
): Promise<string> {
  const maxBuffer = options.maxBuffer ?? DEFAULT_MAX_BUFFER;
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd,
      maxBuffer,
      encoding: 'utf8',
    });
    return stdout;
  } catch (caught: unknown) {
    const err = caught as { stderr?: string; message?: string };
    const stderr = err.stderr?.trim() ?? '';
    throw new Error(stderr || err.message || String(caught));
  }
}
