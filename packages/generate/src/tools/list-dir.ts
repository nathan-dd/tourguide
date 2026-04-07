import { execGit } from './git.js';

function lsTreePathArg(dirPath: string): string {
  const trimmed = dirPath.replace(/\/+$/, '');
  return trimmed === '' ? '' : `${trimmed}/`;
}

export async function executeListDirectory(
  params: { ref: string; dirPath?: string },
  repoPath: string,
): Promise<string> {
  const { ref, dirPath } = params;
  const args = ['ls-tree', '--name-only', ref];
  if (dirPath !== undefined && dirPath !== '') {
    args.push(lsTreePathArg(dirPath));
  }
  return await execGit(args, repoPath);
}
