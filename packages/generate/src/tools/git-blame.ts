import { execGit } from './git.js';

export type GitBlameParams = {
  filePath: string;
  startLine?: number;
  endLine?: number;
};

export async function executeGitBlame(params: GitBlameParams, repoPath: string): Promise<string> {
  const { filePath } = params;
  const hasStart = params.startLine !== undefined;
  const hasEnd = params.endLine !== undefined;
  if (hasStart !== hasEnd) {
    throw new Error(
      'git blame: provide both startLine and endLine for a range, or omit both for the full file',
    );
  }

  const args: string[] = ['blame'];
  if (hasStart && hasEnd) {
    args.push('-L', `${params.startLine},${params.endLine}`);
  }
  args.push('--', filePath);

  try {
    return await execGit(args, repoPath);
  } catch (caught: unknown) {
    const msg = caught instanceof Error ? caught.message : String(caught);
    const lower = msg.toLowerCase();
    if (lower.includes('no such path') || lower.includes('does not exist')) {
      throw new Error(`Cannot blame ${filePath}: ${msg}`);
    }
    throw caught;
  }
}
