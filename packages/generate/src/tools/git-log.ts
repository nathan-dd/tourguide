import { execGit } from './git.js';

export type GitLogParams = {
  filePath?: string;
  maxEntries?: number;
};

export async function executeGitLog(params: GitLogParams, repoPath: string): Promise<string> {
  const maxEntries = params.maxEntries ?? 20;
  const args = ['log', '--oneline', '-n', String(maxEntries)];
  if (params.filePath !== undefined && params.filePath !== '') {
    args.push('--', params.filePath);
  }
  return await execGit(args, repoPath);
}
