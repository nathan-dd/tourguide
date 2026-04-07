import { tool } from 'ai';
import { z } from 'zod';
import { executeGitBlame } from './git-blame.js';
import { executeGitLog } from './git-log.js';
import { executeListDirectory } from './list-dir.js';
import { executeReadFileAtRef } from './read-file.js';
import { executeSearchCodebase } from './search.js';

/**
 * AI SDK tool definitions for exploring a git repository (e.g. a PR branch vs base).
 * Each tool runs against `repoPath` captured when this factory is called.
 */
export function createTools(repoPath: string) {
  return {
    readFileAtRef: tool({
      description:
        'Read the full contents of a file as it existed at a specific git ref (commit, branch, or tag). Use this to inspect implementation details, diffs in context, or files that only exist on one side of a PR.',
      inputSchema: z.object({
        ref: z.string().describe('Git ref to read from (commit SHA, branch name, or tag).'),
        filePath: z.string().describe('Repository-relative path to the file (e.g. src/app.ts).'),
      }),
      execute: async (input) => executeReadFileAtRef(input, repoPath),
    }),

    searchCodebase: tool({
      description:
        'Search the working tree with ripgrep for a regex pattern. Use this to find symbols, callers, imports, or error strings across the repo when exploring a PR or unfamiliar code.',
      inputSchema: z.object({
        pattern: z.string().describe('Ripgrep regex pattern to search for.'),
        glob: z
          .string()
          .optional()
          .describe('Optional glob filter (e.g. "*.ts", "src/**") to limit files.'),
      }),
      execute: async (input) => executeSearchCodebase(input, repoPath),
    }),

    listDirectory: tool({
      description:
        'List file and directory names at a path in the tree at a given git ref. Use this to discover layout, packages, or where to read next without guessing paths.',
      inputSchema: z.object({
        ref: z.string().describe('Git ref whose tree to list (commit, branch, or tag).'),
        dirPath: z
          .string()
          .optional()
          .describe('Directory path relative to repo root; omit or empty for repository root.'),
      }),
      execute: async (input) => executeListDirectory(input, repoPath),
    }),

    gitLog: tool({
      description:
        'Show recent commit history (oneline). Use this to understand how an area evolved, related commits in a PR, or who touched a file when timeline context matters.',
      inputSchema: z.object({
        filePath: z
          .string()
          .optional()
          .describe('If set, limit history to commits that touched this path.'),
        maxEntries: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Maximum commits to return (default 20).'),
      }),
      execute: async (input) => executeGitLog(input, repoPath),
    }),

    gitBlame: tool({
      description:
        'Run git blame on a file to see which commit last modified each line. Use this to attribute changes, find when a line was introduced, or connect PR discussion to specific revisions.',
      inputSchema: z.object({
        filePath: z.string().describe('Repository-relative path to the file to blame.'),
        startLine: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Start line of a range (1-based); must be used with endLine.'),
        endLine: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('End line of a range (1-based); must be used with startLine.'),
      }),
      execute: async (input) => executeGitBlame(input, repoPath),
    }),
  };
}
