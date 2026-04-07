import { execGit } from './git.js';

export async function executeReadFileAtRef(
  params: { ref: string; filePath: string },
  repoPath: string,
): Promise<string> {
  const { ref, filePath } = params;
  const spec = `${ref}:${filePath}`;
  try {
    return await execGit(['show', spec], repoPath);
  } catch (caught: unknown) {
    const msg = caught instanceof Error ? caught.message : String(caught);
    const lower = msg.toLowerCase();
    if (
      lower.includes('does not exist') ||
      lower.includes('exists on disk, but not in') ||
      lower.includes('fatal: bad object') ||
      lower.includes('invalid object name') ||
      lower.includes('ambiguous argument')
    ) {
      throw new Error(`No file at ${filePath} for ref ${ref}: ${msg}`);
    }
    throw caught;
  }
}
