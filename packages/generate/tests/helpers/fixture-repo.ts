import { randomBytes } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execGit } from '../../src/tools/git.js';

export async function createFixtureRepo(): Promise<{
  repoPath: string;
  baseRef: string;
  headRef: string;
}> {
  const repoPath = path.join(tmpdir(), `tourguide-fixture-${randomBytes(8).toString('hex')}`);
  await mkdir(repoPath, { recursive: true });

  await execGit(['init', '-b', 'main'], repoPath);
  await execGit(['config', 'user.email', 'fixture@test.local'], repoPath);
  await execGit(['config', 'user.name', 'Fixture'], repoPath);

  const mathV1 = `export function add(a: number, b: number): number {
  return a + b;
}
`;
  const utilsTs = `export function greet(name: string): string {
  return \`Hello, \${name}\`;
}
`;
  const readme = '# fixture\n';

  await mkdir(path.join(repoPath, 'src'), { recursive: true });
  await writeFile(path.join(repoPath, 'src', 'math.ts'), mathV1, 'utf8');
  await writeFile(path.join(repoPath, 'src', 'utils.ts'), utilsTs, 'utf8');
  await writeFile(path.join(repoPath, 'README.md'), readme, 'utf8');

  await execGit(['add', '.'], repoPath);
  await execGit(['commit', '-m', 'commit1: initial'], repoPath);
  const baseRef = (await execGit(['rev-parse', 'HEAD'], repoPath)).trim();

  const mathV2 = `export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}
`;
  const apiTs = `import { add, multiply } from './math';

export function demo(x: number, y: number): number {
  return add(x, y) + multiply(x, y);
}
`;

  await writeFile(path.join(repoPath, 'src', 'math.ts'), mathV2, 'utf8');
  await writeFile(path.join(repoPath, 'src', 'api.ts'), apiTs, 'utf8');

  await execGit(['add', '.'], repoPath);
  await execGit(['commit', '-m', 'commit2: extend math, add api'], repoPath);
  const headRef = (await execGit(['rev-parse', 'HEAD'], repoPath)).trim();

  return { repoPath, baseRef, headRef };
}

export async function cleanupFixtureRepo(repoPath: string): Promise<void> {
  await rm(repoPath, { recursive: true, force: true });
}
