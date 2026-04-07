# M1: CLI Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `@tourguide/cli` with validate/play/summary commands and harden `@tourguide/core` foundation (graph merge + traversal edge cases).

**Architecture:** Thin CLI wrappers composing `@tourguide/format` and `@tourguide/core` APIs. Pure formatting functions return strings; commands orchestrate loading, formatting, and output. Testable via injected output interface.

**Tech Stack:** TypeScript, commander.js, chalk, vitest, tsup, pnpm workspaces

**Spec:** `docs/superpowers/specs/2026-04-06-cli-scaffold-design.md`

---

## Shared Patterns

These patterns are used across multiple tasks. Each task repeats the relevant code inline (for out-of-order reading), but the canonical definitions are here.

**Output interface** (used by all commands for testability):

```typescript
// packages/cli/src/output.ts
export type Output = {
  log: (text: string) => void;
  error: (text: string) => void;
};

export const consoleOutput: Output = {
  log: (text) => console.log(text),
  error: (text) => console.error(text),
};
```

**Test output helper** (used in all CLI tests):

```typescript
function createTestOutput() {
  const lines: string[] = [];
  const errors: string[] = [];
  return {
    output: {
      log: (text: string) => lines.push(text),
      error: (text: string) => errors.push(text),
    } satisfies Output,
    lines,
    errors,
  };
}
```

**Fixture paths** (relative to `packages/cli/`):

```typescript
const FIXTURES = {
  minimal: '../../packages/core/tests/fixtures/minimal.tourguide',
  sample: '../../packages/core/tests/fixtures/sample.tourguide',
  invalid: '../../packages/core/tests/fixtures/invalid.tourguide',
  exampleSample: '../../examples/sample.tourguide',
};
```

---

## Task 1: buildGraph — merge per-step connections

**Files:**

- Modify: `packages/core/src/graph.ts`
- Test: `packages/core/tests/graph.test.ts`
- **Step 1: Write failing test for per-step-only connections**

Add this test to `packages/core/tests/graph.test.ts`:

```typescript
import type { Tour } from '@tourguide/format';

function makeTourWithPerStepConnections(): Tour {
  return {
    version: '1.0.0',
    title: 'Per-step connections',
    description: 'Test',
    mode: 'codebase',
    ref: 'main',
    overview: { summary: 'Test', fileMap: [] },
    chapters: [
      {
        id: 'ch-1',
        title: 'Ch 1',
        summary: 'S',
        steps: [
          {
            id: 's-1',
            file: 'a.ts',
            range: { start: { line: 1, character: 0 }, end: { line: 2, character: 0 } },
            title: 'S1',
            description: 'D',
            kind: 'utility',
            chapter: 'ch-1',
            connections: [{ from: 's-1', to: 's-2', type: 'calls' }],
            annotationRefs: [],
          },
          {
            id: 's-2',
            file: 'b.ts',
            range: { start: { line: 1, character: 0 }, end: { line: 2, character: 0 } },
            title: 'S2',
            description: 'D',
            kind: 'utility',
            chapter: 'ch-1',
            connections: [],
            annotationRefs: [],
          },
        ],
      },
    ],
    annotations: [],
    connections: [],
  } as Tour;
}

describe('buildGraph — per-step connections', () => {
  it('indexes connections defined only on steps', () => {
    const tour = makeTourWithPerStepConnections();
    const graph = buildGraph(tour);
    expect(graph.outgoing('s-1')).toHaveLength(1);
    expect(graph.outgoing('s-1')[0].type).toBe('calls');
    expect(graph.incoming('s-2')).toHaveLength(1);
  });

  it('deduplicates overlapping top-level and per-step connections', () => {
    const graph = buildGraph(sampleTour);
    // sampleTour has step-1→step-2 (calls) both per-step and top-level
    const outgoing = graph.outgoing('step-1');
    const callsToStep2 = outgoing.filter((c) => c.to === 'step-2' && c.type === 'calls');
    expect(callsToStep2).toHaveLength(1);
  });

  it('resolves related nodes from per-step connections', () => {
    const tour = makeTourWithPerStepConnections();
    const graph = buildGraph(tour);
    const related = graph.related('s-1');
    expect(related).toHaveLength(1);
    expect(related[0].node.id).toBe('s-2');
  });
});
```

- **Step 2: Run tests to verify they fail**

Run: `pnpm test --filter @tourguide/core`
Expected: FAIL — per-step connections not indexed, `outgoing('s-1')` returns empty array.

- **Step 3: Implement per-step connection merging**

Replace `buildGraph` in `packages/core/src/graph.ts`:

```typescript
function collectConnections(tour: Tour): Connection[] {
  const byKey = new Map<string, Connection>();

  for (const connection of tour.connections) {
    byKey.set(`${connection.from}|${connection.to}|${connection.type}`, connection);
  }

  for (const chapter of tour.chapters) {
    for (const step of chapter.steps) {
      for (const connection of step.connections) {
        const key = `${connection.from}|${connection.to}|${connection.type}`;
        if (!byKey.has(key)) {
          byKey.set(key, connection);
        }
      }
    }
  }

  return Array.from(byKey.values());
}

export function buildGraph(tour: Tour): TourGraph {
  const outgoingByNode = new Map<string, Connection[]>();
  const incomingByNode = new Map<string, Connection[]>();

  for (const connection of collectConnections(tour)) {
    const outgoing = outgoingByNode.get(connection.from) ?? [];
    outgoing.push(connection);
    outgoingByNode.set(connection.from, outgoing);

    const incoming = incomingByNode.get(connection.to) ?? [];
    incoming.push(connection);
    incomingByNode.set(connection.to, incoming);
  }

  return {
    outgoing(id: string) {
      return outgoingByNode.get(id) ?? [];
    },
    incoming(id: string) {
      return incomingByNode.get(id) ?? [];
    },
    related(id: string) {
      return (outgoingByNode.get(id) ?? [])
        .map((connection) => ({
          connection,
          node: resolveNode(tour, connection.to),
        }))
        .filter((item): item is RelatedNode => item.node !== undefined);
    },
    byType(id: string, type: ConnectionType) {
      return this.related(id)
        .filter((item) => item.connection.type === type)
        .map((item) => item.node);
    },
  };
}
```

- **Step 4: Run tests to verify they pass**

Run: `pnpm test --filter @tourguide/core`
Expected: ALL PASS (both new and existing graph tests).

- **Step 5: Commit**

```bash
git add packages/core/src/graph.ts packages/core/tests/graph.test.ts
git commit -m "fix(core): merge per-step connections into buildGraph

buildGraph now collects connections from both tour.connections and
per-step connections arrays, deduplicating by from+to+type key.
Top-level connections take priority for descriptions."
```

---

## Task 2: Traversal — handle empty chapters and empty tours

**Files:**

- Modify: `packages/core/src/traversal.ts`
- Test: `packages/core/tests/traversal.test.ts`
- **Step 1: Write failing tests for empty tour and empty chapters**

Add these tests to `packages/core/tests/traversal.test.ts`:

```typescript
import type { Tour } from '@tourguide/format';

const emptyTour: Tour = {
  version: '1.0.0',
  title: 'Empty',
  description: 'No chapters',
  mode: 'codebase',
  ref: 'main',
  overview: { summary: 'Empty', fileMap: [] },
  chapters: [],
  annotations: [],
  connections: [],
} as Tour;

const tourWithEmptyChapters: Tour = {
  version: '1.0.0',
  title: 'Gaps',
  description: 'Has empty chapters',
  mode: 'codebase',
  ref: 'main',
  overview: { summary: 'Test', fileMap: [] },
  chapters: [
    { id: 'empty-1', title: 'Empty first', summary: 'S', steps: [] },
    {
      id: 'ch-1',
      title: 'Has steps',
      summary: 'S',
      steps: [
        {
          id: 's-1',
          file: 'a.ts',
          range: { start: { line: 1, character: 0 }, end: { line: 2, character: 0 } },
          title: 'S1',
          description: 'D',
          kind: 'utility',
          chapter: 'ch-1',
          connections: [],
          annotationRefs: [],
        },
      ],
    },
    { id: 'empty-2', title: 'Empty mid', summary: 'S', steps: [] },
    {
      id: 'ch-2',
      title: 'Also has steps',
      summary: 'S',
      steps: [
        {
          id: 's-2',
          file: 'b.ts',
          range: { start: { line: 1, character: 0 }, end: { line: 2, character: 0 } },
          title: 'S2',
          description: 'D',
          kind: 'utility',
          chapter: 'ch-2',
          connections: [],
          annotationRefs: [],
        },
      ],
    },
  ],
  annotations: [],
  connections: [],
} as Tour;

describe('traversal — empty tours', () => {
  it('returns null for first/last position in empty tour', () => {
    expect(firstPosition(emptyTour)).toBeNull();
    expect(lastPosition(emptyTour)).toBeNull();
  });

  it('returns null for next/prev on empty tour with null position', () => {
    expect(totalSteps(emptyTour)).toBe(0);
  });

  it('returns 0/0 progress for null position', () => {
    const progress = getProgress(emptyTour, null);
    expect(progress.chapter).toEqual({ current: 0, total: 0 });
    expect(progress.overallStep).toEqual({ current: 0, total: 0 });
  });
});

describe('traversal — empty chapters', () => {
  it('skips empty first chapter in firstPosition', () => {
    const pos = firstPosition(tourWithEmptyChapters);
    expect(pos).toEqual({ chapterIndex: 1, stepIndex: 0 });
  });

  it('skips empty last chapter in lastPosition', () => {
    const pos = lastPosition(tourWithEmptyChapters);
    expect(pos).toEqual({ chapterIndex: 3, stepIndex: 0 });
  });

  it('nextChapter skips empty chapters', () => {
    const start = firstPosition(tourWithEmptyChapters)!;
    const next = nextChapter(tourWithEmptyChapters, start);
    expect(next).toEqual({ chapterIndex: 3, stepIndex: 0 });
  });

  it('prevChapter skips empty chapters', () => {
    const end = lastPosition(tourWithEmptyChapters)!;
    const prev = prevChapter(tourWithEmptyChapters, end);
    expect(prev).toEqual({ chapterIndex: 1, stepIndex: 0 });
  });

  it('nextStep crosses empty chapters', () => {
    const start = firstPosition(tourWithEmptyChapters)!;
    const next = nextStep(tourWithEmptyChapters, start);
    expect(next).toEqual({ chapterIndex: 3, stepIndex: 0 });
  });
});
```

- **Step 2: Run tests to verify they fail**

Run: `pnpm test --filter @tourguide/core`
Expected: FAIL — `firstPosition` returns `{0, 0}` instead of `null` or `{1, 0}`.

- **Step 3: Implement traversal hardening**

Replace functions in `packages/core/src/traversal.ts`:

```typescript
export function firstPosition(tour: Tour): TourPosition | null {
  for (let chapterIndex = 0; chapterIndex < tour.chapters.length; chapterIndex += 1) {
    if (tour.chapters[chapterIndex].steps.length > 0) {
      return { chapterIndex, stepIndex: 0 };
    }
  }
  return null;
}

export function lastPosition(tour: Tour): TourPosition | null {
  for (let chapterIndex = tour.chapters.length - 1; chapterIndex >= 0; chapterIndex -= 1) {
    const steps = tour.chapters[chapterIndex].steps;
    if (steps.length > 0) {
      return { chapterIndex, stepIndex: steps.length - 1 };
    }
  }
  return null;
}
```

Replace `nextChapter` and `prevChapter`:

```typescript
export function nextChapter(tour: Tour, position: TourPosition): TourPosition | null {
  for (
    let chapterIndex = position.chapterIndex + 1;
    chapterIndex < tour.chapters.length;
    chapterIndex += 1
  ) {
    if (tour.chapters[chapterIndex].steps.length > 0) {
      return { chapterIndex, stepIndex: 0 };
    }
  }
  return null;
}

export function prevChapter(tour: Tour, position: TourPosition): TourPosition | null {
  for (let chapterIndex = position.chapterIndex - 1; chapterIndex >= 0; chapterIndex -= 1) {
    if (tour.chapters[chapterIndex].steps.length > 0) {
      return { chapterIndex, stepIndex: 0 };
    }
  }
  return null;
}
```

Update `getProgress` to accept `TourPosition | null`:

```typescript
export function getProgress(tour: Tour, position: TourPosition | null): TourProgress {
  if (!position) {
    return {
      chapter: { current: 0, total: tour.chapters.length },
      chapterStep: { current: 0, total: 0 },
      overallStep: { current: 0, total: totalSteps(tour) },
    };
  }
  return {
    chapter: {
      current: position.chapterIndex + 1,
      total: tour.chapters.length,
    },
    chapterStep: {
      current: position.stepIndex + 1,
      total: getChapter(tour, position).steps.length,
    },
    overallStep: {
      current: globalStepOffset(tour, position) + 1,
      total: totalSteps(tour),
    },
  };
}
```

- **Step 4: Update existing tests for new return types**

In `packages/core/tests/traversal.test.ts`, the existing test `'returns first and last positions'` asserts `firstPosition(sampleTour)` returns a value. Add non-null assertions where needed since the sampleTour is not empty:

```typescript
it('returns first and last positions', () => {
  expect(firstPosition(sampleTour)).toEqual({ chapterIndex: 0, stepIndex: 0 });
  expect(lastPosition(sampleTour)).toEqual({ chapterIndex: 1, stepIndex: 0 });
});

it('advances and retreats across chapter boundaries', () => {
  const start = firstPosition(sampleTour)!;
  const second = nextStep(sampleTour, start);
  expect(second).toEqual({ chapterIndex: 1, stepIndex: 0 });
  expect(prevStep(sampleTour, second!)).toEqual(start);
});

it('jumps by chapter', () => {
  const start = firstPosition(sampleTour)!;
  const next = nextChapter(sampleTour, start);
  expect(next).toEqual({ chapterIndex: 1, stepIndex: 0 });
  expect(prevChapter(sampleTour, next!)).toEqual(start);
});

it('returns null at boundaries', () => {
  const start = firstPosition(sampleTour)!;
  const end = lastPosition(sampleTour)!;
  expect(prevStep(sampleTour, start)).toBeNull();
  expect(nextStep(sampleTour, end)).toBeNull();
});

it('returns current chapter, step and progress', () => {
  const pos = firstPosition(sampleTour)!;
  expect(getChapter(sampleTour, pos).id).toBe('chapter-1');
  expect(getStep(sampleTour, pos).id).toBe('step-1');
  expect(getProgress(sampleTour, pos)).toEqual({
    chapter: { current: 1, total: 2 },
    chapterStep: { current: 1, total: 1 },
    overallStep: { current: 1, total: 2 },
  });
});
```

- **Step 5: Run tests to verify all pass**

Run: `pnpm test --filter @tourguide/core`
Expected: ALL PASS.

- **Step 6: Commit**

```bash
git add packages/core/src/traversal.ts packages/core/tests/traversal.test.ts
git commit -m "fix(core): handle empty chapters and tours in traversal

firstPosition/lastPosition return null for empty tours and skip empty
chapters. nextChapter/prevChapter skip empty chapters. getProgress
accepts null position and returns 0/0 progress."
```

---

## Task 3: CLI package scaffold

**Files:**

- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/src/cli.ts`
- Create: `packages/cli/src/output.ts`
- **Step 1: Create package.json**

Create `packages/cli/package.json`:

```json
{
  "name": "@tourguide/cli",
  "version": "0.1.0",
  "description": "Tourguide CLI — validate, play, and summarize code tours",
  "license": "MIT",
  "type": "module",
  "bin": {
    "tourguide": "./dist/cli.js"
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsup src/cli.ts --format esm --dts",
    "test": "vitest run --passWithNoTests",
    "lint": "biome check src tests"
  },
  "dependencies": {
    "@tourguide/format": "workspace:*",
    "@tourguide/core": "workspace:*",
    "chalk": "^5.4.1",
    "commander": "^13.1.0"
  }
}
```

- **Step 2: Create tsconfig.json**

Create `packages/cli/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": [
    "src"
  ],
  "references": [
    {
      "path": "../format"
    },
    {
      "path": "../core"
    }
  ]
}
```

- **Step 3: Create output.ts**

Create `packages/cli/src/output.ts`:

```typescript
export type Output = {
  log: (text: string) => void;
  error: (text: string) => void;
};

export const consoleOutput: Output = {
  log: (text) => console.log(text),
  error: (text) => console.error(text),
};
```

- **Step 4: Create cli.ts entry point skeleton**

Create `packages/cli/src/cli.ts`:

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

const program = new Command();

program.name('tourguide').description('Guided code understanding').version(version);

program
  .command('validate')
  .description('Validate .tourguide files')
  .argument('<files...>', 'tour files to validate')
  .action(async (files: string[]) => {
    const { validate } = await import('./commands/validate.js');
    const exitCode = await validate(files);
    process.exit(exitCode);
  });

program
  .command('summary')
  .description('Print a tour summary')
  .argument('<file>', 'tour file')
  .action(async (file: string) => {
    const { summary } = await import('./commands/summary.js');
    const exitCode = await summary(file);
    process.exit(exitCode);
  });

program
  .command('play')
  .description('Interactively play through a tour')
  .argument('<file>', 'tour file')
  .action(async (file: string) => {
    const { play } = await import('./commands/play.js');
    const exitCode = await play(file);
    process.exit(exitCode);
  });

program.parse();
```

- **Step 5: Install dependencies**

```bash
cd packages/cli && pnpm install
```

- **Step 6: Verify build works (will fail on missing command files — that's expected)**

```bash
pnpm build --filter @tourguide/cli
```

Expected: Build failure because command files don't exist yet. That's fine — we just need the scaffold committed.

- **Step 7: Commit scaffold**

```bash
git add packages/cli/
git commit -m "feat(cli): scaffold @tourguide/cli package

Sets up package.json with commander + chalk deps, tsconfig with
project references, entry point with validate/play/summary command
stubs, and the Output interface for testable commands."
```

---

## Task 4: Error formatting + validate command

**Files:**

- Create: `packages/cli/src/format/errors.ts`
- Create: `packages/cli/tests/format/errors.test.ts`
- Create: `packages/cli/src/commands/validate.ts`
- Create: `packages/cli/tests/validate.test.ts`
- **Step 1: Write failing tests for error formatting**

Create `packages/cli/tests/format/errors.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { formatFileResult, formatValidationError } from '../../src/format/errors';
import type { ValidationError } from '@tourguide/format';

describe('formatValidationError', () => {
  it('formats schema errors with path', () => {
    const error: ValidationError = {
      path: 'steps[2].range.start.line',
      message: 'Expected number, received string',
      code: 'invalid_type',
    };
    const result = formatValidationError(error);
    expect(result).toContain('steps[2].range.start.line');
    expect(result).toContain('Expected number, received string');
  });

  it('formats semantic errors', () => {
    const error: ValidationError = {
      path: 'chapters.chapter-1.steps.step-1.chapter',
      message: 'Unknown chapter reference "missing-chapter"',
      code: 'unknown-chapter-reference',
    };
    const result = formatValidationError(error);
    expect(result).toContain('Unknown chapter reference');
    expect(result).toContain('missing-chapter');
  });

  it('formats file read errors', () => {
    const error: ValidationError = {
      path: '$',
      message: "ENOENT: no such file or directory, open 'missing.tourguide'",
      code: 'file-read-error',
    };
    const result = formatValidationError(error);
    expect(result).toContain('ENOENT');
  });
});

describe('formatFileResult', () => {
  it('formats success with title and counts', () => {
    const result = formatFileResult('tour.tourguide', {
      success: true,
      title: 'My Tour',
      chapterCount: 3,
      stepCount: 12,
    });
    expect(result).toContain('My Tour');
    expect(result).toContain('3 chapters');
    expect(result).toContain('12 steps');
    expect(result).toContain('✓');
  });

  it('formats failure with error list', () => {
    const errors: ValidationError[] = [
      { path: '$.title', message: 'Required', code: 'invalid_type' },
    ];
    const result = formatFileResult('bad.tourguide', { success: false, errors });
    expect(result).toContain('bad.tourguide');
    expect(result).toContain('✗');
    expect(result).toContain('Required');
  });
});
```

- **Step 2: Run tests to verify they fail**

Run: `pnpm test --filter @tourguide/cli`
Expected: FAIL — module not found.

- **Step 3: Implement error formatting**

Create `packages/cli/src/format/errors.ts`:

```typescript
import chalk from 'chalk';
import type { ValidationError } from '@tourguide/format';

export function formatValidationError(error: ValidationError): string {
  const path = error.path === '$' ? '' : ` ${chalk.dim(error.path)}`;
  return `  ${chalk.red('✗')}${path} — ${error.message}`;
}

type FileSuccess = {
  success: true;
  title: string;
  chapterCount: number;
  stepCount: number;
};

type FileFailure = {
  success: false;
  errors: ValidationError[];
};

export type FileResult = FileSuccess | FileFailure;

export function formatFileResult(file: string, result: FileResult): string {
  if (result.success) {
    return `${chalk.green('✓')} ${chalk.bold(file)} — ${result.title} (${result.chapterCount} chapters, ${result.stepCount} steps)`;
  }

  const header = `${chalk.red('✗')} ${chalk.bold(file)}`;
  const errorLines = result.errors.map(formatValidationError);
  return [header, ...errorLines].join('\n');
}
```

- **Step 4: Run format tests to verify they pass**

Run: `pnpm test --filter @tourguide/cli -- tests/format/errors.test.ts`
Expected: PASS.

- **Step 5: Write failing tests for validate command**

Create `packages/cli/tests/validate.test.ts`:

```typescript
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Output } from '../src/output';
import { validate } from '../src/commands/validate';

function createTestOutput() {
  const lines: string[] = [];
  const errors: string[] = [];
  return {
    output: {
      log: (text: string) => lines.push(text),
      error: (text: string) => errors.push(text),
    } satisfies Output,
    lines,
    errors,
  };
}

const fixture = (name: string) => resolve(process.cwd(), '..', 'core', 'tests', 'fixtures', name);

describe('validate command', () => {
  it('reports valid file with tour info', async () => {
    const { output, lines } = createTestOutput();
    const code = await validate([fixture('minimal.tourguide')], output);
    expect(code).toBe(0);
    expect(lines.join('\n')).toContain('Minimal tour');
    expect(lines.join('\n')).toContain('✓');
  });

  it('reports invalid file with errors', async () => {
    const { output, errors } = createTestOutput();
    const code = await validate([fixture('invalid.tourguide')], output);
    expect(code).toBe(1);
    expect(errors.join('\n')).toContain('✗');
    expect(errors.join('\n')).toContain('Unknown chapter reference');
  });

  it('reports file-not-found', async () => {
    const { output, errors } = createTestOutput();
    const code = await validate(['/nonexistent/file.tourguide'], output);
    expect(code).toBe(1);
    expect(errors.join('\n')).toContain('✗');
  });

  it('validates multiple files — exits 1 if any fail', async () => {
    const { output, lines, errors } = createTestOutput();
    const code = await validate(
      [fixture('minimal.tourguide'), fixture('invalid.tourguide')],
      output,
    );
    expect(code).toBe(1);
    expect(lines.join('\n')).toContain('✓');
    expect(errors.join('\n')).toContain('✗');
  });
});
```

- **Step 6: Run validate tests to verify they fail**

Run: `pnpm test --filter @tourguide/cli -- tests/validate.test.ts`
Expected: FAIL — module not found.

- **Step 7: Implement validate command**

Create `packages/cli/src/commands/validate.ts`:

```typescript
import { TourLoadError, loadTour, totalSteps } from '@tourguide/core';
import { consoleOutput, type Output } from '../output.js';
import { formatFileResult } from '../format/errors.js';

export async function validate(
  files: string[],
  output: Output = consoleOutput,
): Promise<number> {
  let hasErrors = false;

  for (const file of files) {
    try {
      const tour = await loadTour(file);
      output.log(
        formatFileResult(file, {
          success: true,
          title: tour.title,
          chapterCount: tour.chapters.length,
          stepCount: totalSteps(tour),
        }),
      );
    } catch (error) {
      hasErrors = true;
      if (error instanceof TourLoadError) {
        output.error(formatFileResult(file, { success: false, errors: error.errors }));
      } else {
        output.error(
          formatFileResult(file, {
            success: false,
            errors: [
              {
                path: '$',
                message: error instanceof Error ? error.message : 'Unknown error',
                code: 'unknown-error',
              },
            ],
          }),
        );
      }
    }
  }

  return hasErrors ? 1 : 0;
}
```

- **Step 8: Run all CLI tests to verify they pass**

Run: `pnpm test --filter @tourguide/cli`
Expected: ALL PASS.

- **Step 9: Commit**

```bash
git add packages/cli/src/format/errors.ts packages/cli/tests/format/errors.test.ts \
  packages/cli/src/commands/validate.ts packages/cli/tests/validate.test.ts
git commit -m "feat(cli): add validate command with error formatting

Validate loads each file via @tourguide/core, reports success with
tour title and step counts, reports failures with categorized errors
(schema, semantic, file-read). Supports multiple file arguments."
```

---

## Task 5: Tour and code formatting + summary command

**Files:**

- Create: `packages/cli/src/format/tour.ts`
- Create: `packages/cli/src/format/code.ts`
- Create: `packages/cli/tests/format/tour.test.ts`
- Create: `packages/cli/src/commands/summary.ts`
- Create: `packages/cli/tests/summary.test.ts`
- **Step 1: Write failing tests for tour formatting**

Create `packages/cli/tests/format/tour.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
  formatChapterTransition,
  formatStepDisplay,
  formatSummary,
} from '../../src/format/tour';
import { formatCodeBlock } from '../../src/format/code';
import type { Tour, Chapter, Step } from '@tourguide/format';
import type { TourProgress } from '@tourguide/core';

describe('formatCodeBlock', () => {
  it('formats code with line numbers in a box', () => {
    const code = 'function hello() {\n  return "world";\n}';
    const result = formatCodeBlock(code, 10);
    expect(result).toContain('10');
    expect(result).toContain('12');
    expect(result).toContain('function hello()');
    expect(result).toContain('┌');
    expect(result).toContain('└');
    expect(result).toContain('│');
  });

  it('pads line numbers to consistent width', () => {
    const code = Array.from({ length: 5 }, (_, i) => `line ${i}`).join('\n');
    const result = formatCodeBlock(code, 98);
    expect(result).toContain(' 98');
    expect(result).toContain('100');
    expect(result).toContain('102');
  });
});

describe('formatStepDisplay', () => {
  it('includes progress, title, file path, and description', () => {
    const progress: TourProgress = {
      chapter: { current: 2, total: 4 },
      chapterStep: { current: 3, total: 5 },
      overallStep: { current: 8, total: 12 },
    };
    const chapter: Chapter = {
      id: 'ch-2',
      title: 'Data Validation',
      summary: 'S',
      steps: [],
    };
    const step: Step = {
      id: 's-3',
      file: 'src/validation.ts',
      range: { start: { line: 15, character: 0 }, end: { line: 42, character: 0 } },
      title: 'Validate Input',
      description: 'This validates user input.',
      kind: 'utility',
      chapter: 'ch-2',
      connections: [],
      annotationRefs: [],
    };
    const result = formatStepDisplay(progress, chapter, step, null);
    expect(result).toContain('Chapter 2/4');
    expect(result).toContain('Data Validation');
    expect(result).toContain('Step 8/12');
    expect(result).toContain('Validate Input');
    expect(result).toContain('src/validation.ts:15-42');
    expect(result).toContain('This validates user input.');
  });

  it('includes code block when provided', () => {
    const progress: TourProgress = {
      chapter: { current: 1, total: 1 },
      chapterStep: { current: 1, total: 1 },
      overallStep: { current: 1, total: 1 },
    };
    const chapter: Chapter = { id: 'ch', title: 'Ch', summary: 'S', steps: [] };
    const step: Step = {
      id: 's',
      file: 'a.ts',
      range: { start: { line: 1, character: 0 }, end: { line: 3, character: 0 } },
      title: 'T',
      description: 'D',
      kind: 'utility',
      chapter: 'ch',
      connections: [],
      annotationRefs: [],
    };
    const result = formatStepDisplay(progress, chapter, step, 'const x = 1;\nconst y = 2;');
    expect(result).toContain('const x = 1');
    expect(result).toContain('┌');
  });
});

describe('formatChapterTransition', () => {
  it('includes chapter title and summary', () => {
    const chapter: Chapter = {
      id: 'ch-3',
      title: 'Error Handling',
      summary: 'Building resilient error boundaries',
      steps: [],
    };
    const result = formatChapterTransition(chapter, 3, 5);
    expect(result).toContain('Chapter 3/5');
    expect(result).toContain('Error Handling');
    expect(result).toContain('Building resilient error boundaries');
    expect(result).toContain('━');
  });
});

describe('formatSummary', () => {
  it('includes title, mode, chapters, and file map', () => {
    const tour = {
      version: '1.0.0',
      title: 'My Tour',
      description: 'A tour description',
      mode: 'codebase',
      ref: 'main',
      overview: {
        summary: 'This tour explains things.',
        fileMap: [
          { file: 'src/a.ts', description: 'Main file', relevance: 'primary' },
          { file: 'src/b.ts', description: 'Helper', relevance: 'secondary' },
        ],
      },
      chapters: [
        { id: 'ch-1', title: 'Setup', summary: 'Initial setup', steps: [
          { id: 's-1', file: 'a.ts', range: { start: { line: 1, character: 0 }, end: { line: 2, character: 0 } }, title: 'S1', description: 'D', kind: 'utility', chapter: 'ch-1', connections: [], annotationRefs: [] },
          { id: 's-2', file: 'a.ts', range: { start: { line: 3, character: 0 }, end: { line: 4, character: 0 } }, title: 'S2', description: 'D', kind: 'utility', chapter: 'ch-1', connections: [], annotationRefs: [] },
        ] },
        { id: 'ch-2', title: 'Core', summary: 'Core logic', steps: [
          { id: 's-3', file: 'b.ts', range: { start: { line: 1, character: 0 }, end: { line: 2, character: 0 } }, title: 'S3', description: 'D', kind: 'utility', chapter: 'ch-2', connections: [], annotationRefs: [] },
        ] },
      ],
      annotations: [],
      connections: [],
    } as Tour;
    const result = formatSummary(tour);
    expect(result).toContain('My Tour');
    expect(result).toContain('A tour description');
    expect(result).toContain('codebase');
    expect(result).toContain('This tour explains things.');
    expect(result).toContain('Setup');
    expect(result).toContain('2 steps');
    expect(result).toContain('Core');
    expect(result).toContain('1 step');
    expect(result).toContain('src/a.ts');
    expect(result).toContain('primary');
    expect(result).toContain('src/b.ts');
  });
});
```

- **Step 2: Run tests to verify they fail**

Run: `pnpm test --filter @tourguide/cli -- tests/format/tour.test.ts`
Expected: FAIL — modules not found.

- **Step 3: Implement code formatting**

Create `packages/cli/src/format/code.ts`:

```typescript
import chalk from 'chalk';

export function formatCodeBlock(code: string, startLine: number): string {
  const lines = code.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  const maxLineNum = startLine + lines.length - 1;
  const gutterWidth = String(maxLineNum).length;

  const formatted = lines.map((line, i) => {
    const lineNum = chalk.dim(String(startLine + i).padStart(gutterWidth));
    return `  ${chalk.dim('│')} ${lineNum}  ${line}`;
  });

  const borderLen = 40;
  return [
    `  ${chalk.dim('┌' + '─'.repeat(borderLen))}`,
    ...formatted,
    `  ${chalk.dim('└' + '─'.repeat(borderLen))}`,
  ].join('\n');
}
```

- **Step 4: Implement tour formatting**

Create `packages/cli/src/format/tour.ts`:

```typescript
import chalk from 'chalk';
import type { Chapter, Step, Tour } from '@tourguide/format';
import type { TourProgress } from '@tourguide/core';
import { formatCodeBlock } from './code.js';

export function formatStepDisplay(
  progress: TourProgress,
  chapter: Chapter,
  step: Step,
  sourceCode: string | null,
): string {
  const parts: string[] = [];

  parts.push(
    chalk.dim(
      `  Chapter ${progress.chapter.current}/${progress.chapter.total}: ${chapter.title}`,
    ),
  );
  parts.push(
    `  ${chalk.bold(`Step ${progress.overallStep.current}/${progress.overallStep.total}`)} — ${step.title}`,
  );
  parts.push('');
  parts.push(`  ${chalk.cyan(step.file)}:${step.range.start.line}-${step.range.end.line}`);

  if (sourceCode) {
    parts.push('');
    parts.push(formatCodeBlock(sourceCode, step.range.start.line));
  }

  parts.push('');
  parts.push(`  ${step.description}`);

  return parts.join('\n');
}

export function formatChapterTransition(
  chapter: Chapter,
  chapterNum: number,
  totalChapters: number,
): string {
  const bar = chalk.bold('━'.repeat(50));
  return [
    bar,
    `  ${chalk.bold(`Chapter ${chapterNum}/${totalChapters}: ${chapter.title}`)}`,
    `  ${chalk.dim(chapter.summary)}`,
    bar,
  ].join('\n');
}

export const STEP_SEPARATOR = chalk.dim('─'.repeat(50));

function formatRelevance(relevance: string): string {
  switch (relevance) {
    case 'primary':
      return chalk.green(relevance);
    case 'secondary':
      return chalk.yellow(relevance);
    case 'context':
      return chalk.dim(relevance);
    default:
      return relevance;
  }
}

function formatMode(tour: Tour): string {
  if (tour.mode === 'diff') {
    return `diff (${tour.baseRef}..${tour.headRef})`;
  }
  return tour.ref ? `codebase (${tour.ref})` : 'codebase';
}

export function formatSummary(tour: Tour): string {
  const parts: string[] = [];

  parts.push(chalk.bold(tour.title));
  parts.push(chalk.dim(tour.description));
  parts.push('');
  parts.push(`  ${chalk.dim('Mode:')} ${formatMode(tour)}`);
  parts.push('');
  parts.push(tour.overview.summary);

  parts.push('');
  parts.push(chalk.bold('Chapters'));
  for (let i = 0; i < tour.chapters.length; i += 1) {
    const chapter = tour.chapters[i];
    const count = chapter.steps.length;
    const noun = count === 1 ? 'step' : 'steps';
    parts.push(`  ${i + 1}. ${chapter.title} — ${chalk.dim(`${count} ${noun}`)} — ${chapter.summary}`);
  }

  if (tour.overview.fileMap.length > 0) {
    parts.push('');
    parts.push(chalk.bold('File Map'));
    for (const entry of tour.overview.fileMap) {
      parts.push(
        `  ${formatRelevance(entry.relevance)}  ${chalk.cyan(entry.file)}  ${chalk.dim(entry.description)}`,
      );
    }
  }

  return parts.join('\n');
}
```

- **Step 5: Run format tests to verify they pass**

Run: `pnpm test --filter @tourguide/cli -- tests/format/tour.test.ts`
Expected: ALL PASS.

- **Step 6: Write failing tests for summary command**

Create `packages/cli/tests/summary.test.ts`:

```typescript
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Output } from '../src/output';
import { summary } from '../src/commands/summary';

function createTestOutput() {
  const lines: string[] = [];
  const errors: string[] = [];
  return {
    output: {
      log: (text: string) => lines.push(text),
      error: (text: string) => errors.push(text),
    } satisfies Output,
    lines,
    errors,
  };
}

const fixture = (name: string) => resolve(process.cwd(), '..', 'core', 'tests', 'fixtures', name);

describe('summary command', () => {
  it('prints tour summary for valid file', async () => {
    const { output, lines } = createTestOutput();
    const code = await summary(fixture('sample.tourguide'), output);
    expect(code).toBe(0);
    const text = lines.join('\n');
    expect(text).toContain('Sample tour');
    expect(text).toContain('diff');
    expect(text).toContain('Routing');
    expect(text).toContain('1 step');
    expect(text).toContain('Helper');
    expect(text).toContain('src/entry.ts');
    expect(text).toContain('primary');
  });

  it('reports error for invalid file', async () => {
    const { output, errors } = createTestOutput();
    const code = await summary(fixture('invalid.tourguide'), output);
    expect(code).toBe(1);
    expect(errors.join('\n')).toContain('✗');
  });

  it('reports error for nonexistent file', async () => {
    const { output, errors } = createTestOutput();
    const code = await summary('/nonexistent.tourguide', output);
    expect(code).toBe(1);
  });
});
```

- **Step 7: Implement summary command**

Create `packages/cli/src/commands/summary.ts`:

```typescript
import { TourLoadError, loadTour } from '@tourguide/core';
import { consoleOutput, type Output } from '../output.js';
import { formatFileResult } from '../format/errors.js';
import { formatSummary } from '../format/tour.js';

export async function summary(
  file: string,
  output: Output = consoleOutput,
): Promise<number> {
  try {
    const tour = await loadTour(file);
    output.log(formatSummary(tour));
    return 0;
  } catch (error) {
    if (error instanceof TourLoadError) {
      output.error(formatFileResult(file, { success: false, errors: error.errors }));
    } else {
      output.error(
        formatFileResult(file, {
          success: false,
          errors: [
            {
              path: '$',
              message: error instanceof Error ? error.message : 'Unknown error',
              code: 'unknown-error',
            },
          ],
        }),
      );
    }
    return 1;
  }
}
```

- **Step 8: Run all CLI tests to verify they pass**

Run: `pnpm test --filter @tourguide/cli`
Expected: ALL PASS.

- **Step 9: Commit**

```bash
git add packages/cli/src/format/code.ts packages/cli/src/format/tour.ts \
  packages/cli/tests/format/tour.test.ts \
  packages/cli/src/commands/summary.ts packages/cli/tests/summary.test.ts
git commit -m "feat(cli): add summary command with tour/code formatting

Tour formatting renders step displays with progress, code blocks with
line numbers, chapter transitions, and full tour summaries. Summary
command loads a tour and prints title, mode, chapters, and file map."
```

---

## Task 6: Play command

**Files:**

- Create: `packages/cli/src/commands/play.ts`
- Create: `packages/cli/tests/play.test.ts`
- **Step 1: Write failing tests for play rendering**

Create `packages/cli/tests/play.test.ts`:

```typescript
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Output } from '../src/output';
import { renderTourStep, renderTourHeader, renderTourComplete } from '../src/commands/play';

function createTestOutput() {
  const lines: string[] = [];
  const errors: string[] = [];
  return {
    output: {
      log: (text: string) => lines.push(text),
      error: (text: string) => errors.push(text),
    } satisfies Output,
    lines,
    errors,
  };
}

describe('play rendering', () => {
  it('renderTourHeader shows title and instructions', () => {
    const { output, lines } = createTestOutput();
    renderTourHeader(
      { title: 'My Tour', description: 'A great tour' },
      output,
    );
    const text = lines.join('\n');
    expect(text).toContain('My Tour');
    expect(text).toContain('A great tour');
    expect(text).toContain('Enter');
    expect(text).toContain('q');
  });

  it('renderTourComplete shows step count', () => {
    const { output, lines } = createTestOutput();
    renderTourComplete(12, output);
    const text = lines.join('\n');
    expect(text).toContain('Tour complete');
    expect(text).toContain('12');
  });

  it('renderTourStep shows step with separator', () => {
    const { output, lines } = createTestOutput();
    const progress = {
      chapter: { current: 1, total: 2 },
      chapterStep: { current: 1, total: 3 },
      overallStep: { current: 1, total: 6 },
    };
    const chapter = { id: 'ch', title: 'Ch', summary: 'S', steps: [] as any[] };
    const step = {
      id: 's',
      file: 'a.ts',
      range: { start: { line: 1, character: 0 }, end: { line: 3, character: 0 } },
      title: 'My Step',
      description: 'Step description',
      kind: 'utility' as const,
      chapter: 'ch',
      connections: [] as any[],
      annotationRefs: [] as string[],
    };
    renderTourStep(progress, chapter, step, null, false, output);
    const text = lines.join('\n');
    expect(text).toContain('My Step');
    expect(text).toContain('Step description');
    expect(text).toContain('a.ts');
    expect(text).toContain('─');
  });

  it('renderTourStep shows chapter transition when chapter changes', () => {
    const { output, lines } = createTestOutput();
    const progress = {
      chapter: { current: 2, total: 3 },
      chapterStep: { current: 1, total: 2 },
      overallStep: { current: 4, total: 10 },
    };
    const chapter = { id: 'ch-2', title: 'New Chapter', summary: 'New things', steps: [] as any[] };
    const step = {
      id: 's',
      file: 'b.ts',
      range: { start: { line: 5, character: 0 }, end: { line: 10, character: 0 } },
      title: 'First in chapter',
      description: 'D',
      kind: 'utility' as const,
      chapter: 'ch-2',
      connections: [] as any[],
      annotationRefs: [] as string[],
    };
    renderTourStep(progress, chapter, step, null, true, output);
    const text = lines.join('\n');
    expect(text).toContain('━');
    expect(text).toContain('New Chapter');
  });
});
```

- **Step 2: Run tests to verify they fail**

Run: `pnpm test --filter @tourguide/cli -- tests/play.test.ts`
Expected: FAIL — module not found.

- **Step 3: Implement play command**

Create `packages/cli/src/commands/play.ts`:

```typescript
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import chalk from 'chalk';
import {
  TourLoadError,
  loadTour,
  firstPosition,
  nextStep,
  getChapter,
  getStep,
  getProgress,
  totalSteps,
  resolveStep,
} from '@tourguide/core';
import type { Chapter, Step, Tour } from '@tourguide/format';
import type { TourPosition, TourProgress } from '@tourguide/core';
import { consoleOutput, type Output } from '../output.js';
import { formatFileResult } from '../format/errors.js';
import { formatStepDisplay, formatChapterTransition, STEP_SEPARATOR } from '../format/tour.js';

export function renderTourHeader(
  tour: Pick<Tour, 'title' | 'description'>,
  output: Output = consoleOutput,
): void {
  output.log('');
  output.log(chalk.bold(tour.title));
  output.log(chalk.dim(tour.description));
  output.log('');
  output.log(chalk.dim('  Press Enter to advance, q to quit'));
  output.log('');
}

export function renderTourComplete(stepsVisited: number, output: Output = consoleOutput): void {
  output.log('');
  output.log(chalk.green.bold('  Tour complete!'));
  output.log(chalk.dim(`  ${stepsVisited} steps visited`));
  output.log('');
}

export function renderTourStep(
  progress: TourProgress,
  chapter: Chapter,
  step: Step,
  sourceCode: string | null,
  isChapterTransition: boolean,
  output: Output = consoleOutput,
): void {
  if (isChapterTransition) {
    output.log(formatChapterTransition(chapter, progress.chapter.current, progress.chapter.total));
  } else {
    output.log(STEP_SEPARATOR);
  }
  output.log('');
  output.log(formatStepDisplay(progress, chapter, step, sourceCode));
  output.log('');
}

async function tryReadSource(
  step: Step,
  tourDir: string,
): Promise<string | null> {
  try {
    const filePath = resolve(tourDir, step.file);
    const content = await readFile(filePath, 'utf8');
    const resolved = resolveStep(step, content);
    return resolved?.text ?? null;
  } catch {
    return null;
  }
}

export async function play(
  file: string,
  output: Output = consoleOutput,
): Promise<number> {
  let tour: Tour;
  try {
    tour = await loadTour(file);
  } catch (error) {
    if (error instanceof TourLoadError) {
      output.error(formatFileResult(file, { success: false, errors: error.errors }));
    } else {
      output.error(
        formatFileResult(file, {
          success: false,
          errors: [
            {
              path: '$',
              message: error instanceof Error ? error.message : 'Unknown error',
              code: 'unknown-error',
            },
          ],
        }),
      );
    }
    return 1;
  }

  const startPos = firstPosition(tour);
  if (!startPos) {
    output.log(chalk.yellow('Tour has no steps.'));
    return 0;
  }

  const tourDir = dirname(resolve(file));

  renderTourHeader(tour, output);

  let position: TourPosition = startPos;
  let prevChapterIndex = -1;
  let stepsVisited = 0;

  const showStep = async (pos: TourPosition) => {
    const chapter = getChapter(tour, pos);
    const step = getStep(tour, pos);
    const progress = getProgress(tour, pos);
    const isChapterTransition = pos.chapterIndex !== prevChapterIndex;
    const sourceCode = await tryReadSource(step, tourDir);

    renderTourStep(progress, chapter, step, sourceCode, isChapterTransition, output);
    prevChapterIndex = pos.chapterIndex;
    stepsVisited += 1;
  };

  await showStep(position);

  return new Promise<number>((resolvePromise) => {
    if (!process.stdin.isTTY) {
      renderTourComplete(stepsVisited, output);
      resolvePromise(0);
      return;
    }

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };

    process.stdin.on('data', async (key: string) => {
      if (key === 'q' || key === '\u0003') {
        cleanup();
        output.log('');
        output.log(
          chalk.dim(`  Quit after ${stepsVisited}/${totalSteps(tour)} steps`),
        );
        output.log('');
        resolvePromise(0);
        return;
      }

      if (key === '\r' || key === '\n' || key === '\u001b[C') {
        const next = nextStep(tour, position);
        if (!next) {
          cleanup();
          renderTourComplete(stepsVisited, output);
          resolvePromise(0);
          return;
        }
        position = next;
        await showStep(position);
      }
    });
  });
}
```

- **Step 4: Run tests to verify they pass**

Run: `pnpm test --filter @tourguide/cli`
Expected: ALL PASS.

- **Step 5: Commit**

```bash
git add packages/cli/src/commands/play.ts packages/cli/tests/play.test.ts
git commit -m "feat(cli): add play command with interactive step navigation

Play loads a tour, displays steps with source code (when available),
and navigates via Enter/arrow keys. Shows chapter transitions,
progress tracking, and gracefully handles empty tours and missing
source files."
```

---

## Task 7: Integration wiring and full test run

**Files:**

- Modify: `packages/cli/src/cli.ts` (already has stubs — verify they work)
- **Step 1: Build all packages**

```bash
pnpm build
```

Expected: All three packages build successfully.

- **Step 2: Run full test suite**

```bash
pnpm test
```

Expected: ALL PASS across all packages.

- **Step 3: Run lint**

```bash
pnpm lint
```

Expected: No lint errors. Fix any that appear.

- **Step 4: Smoke test the CLI binary**

```bash
cd packages/cli
node dist/cli.js --version
node dist/cli.js --help
node dist/cli.js validate ../../examples/sample.tourguide
node dist/cli.js validate ../../packages/core/tests/fixtures/invalid.tourguide
node dist/cli.js summary ../../examples/sample.tourguide
```

Expected:

- `--version` prints `0.1.0`
- `--help` shows program description and subcommands
- `validate` on sample shows green checkmark
- `validate` on invalid shows red errors
- `summary` on sample shows tour summary with chapters and file map
- **Step 5: Fix any issues found during smoke testing**

If any commands don't work as expected, fix the issues and re-run tests.

- **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(cli): complete M1 CLI scaffold

All commands working: validate, play, summary. Foundation fixes
applied: buildGraph merges per-step connections, traversal handles
empty chapters/tours. Full test coverage across core fixes and CLI."
```

