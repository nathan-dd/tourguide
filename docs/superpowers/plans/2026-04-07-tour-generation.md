# Tour Generation (M2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `tourguide generate --diff base..head` — agentic LLM generation of valid `.tourguide` files from real git diffs.

**Architecture:** Two-call pipeline (discovery → narration) using the Vercel AI SDK. A discovery `generateText` call with tools explores the codebase, producing a free-form synthesis. A narration `generateText` call with `Output.object({ schema: tourSchema })` produces the structured tour. Validation via `@tourguide/format`, one retry on semantic errors.

**Tech Stack:** Vercel AI SDK (`ai`, `@ai-sdk/anthropic`), `@tourguide/format` (Zod schemas, validation), commander.js (CLI), vitest (tests)

**Design spec:** `docs/superpowers/specs/2026-04-07-tour-generation-design.md`

---

## File Structure

```
packages/generate/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Public API: re-exports generateTour, types
│   ├── types.ts              # GenerateOptions, GenerateResult, ProgressCallback
│   ├── generate.ts           # Main pipeline: generateTour() orchestrating discovery → narration → validate
│   ├── discovery.ts          # runDiscovery(): generateText call with tools, returns synthesis text
│   ├── narration.ts          # runNarration(): generateText + Output.object call, returns Tour
│   ├── prompts.ts            # System prompts for discovery and narration
│   ├── validation.ts         # validateTour(): wraps @tourguide/format validate, retry logic
│   ├── provider.ts           # createModel(): resolves --provider/--model into an AI SDK LanguageModel
│   └── tools/
│       ├── index.ts          # Exports AI SDK tool definitions object
│       ├── git.ts            # execGit() helper — child_process.execFile wrapper with error handling
│       ├── read-file.ts      # readFileAtRef tool: git show ref:path
│       ├── search.ts         # searchCodebase tool: ripgrep wrapper
│       ├── list-dir.ts       # listDirectory tool: git ls-tree
│       ├── git-log.ts        # gitLog tool: git log --oneline
│       └── git-blame.ts      # gitBlame tool: git blame -L
├── tests/
│   ├── helpers/
│   │   └── fixture-repo.ts   # Creates a temp git repo with known commits for deterministic tests
│   ├── tools/
│   │   ├── read-file.test.ts
│   │   ├── search.test.ts
│   │   ├── list-dir.test.ts
│   │   ├── git-log.test.ts
│   │   └── git-blame.test.ts
│   ├── prompts.test.ts
│   ├── validation.test.ts
│   └── generate.integration.test.ts   # Gated behind TOURGUIDE_TEST_LLM=1

packages/cli/
├── src/
│   ├── cli.ts                # Modify: register generate command
│   └── commands/
│       └── generate.ts       # Create: generate command (thin wrapper)
└── tests/
    └── generate.test.ts      # Create: CLI generate flag parsing tests
```

---

## Task 1: Scaffold `packages/generate/`

**Files:**
- Create: `packages/generate/package.json`
- Create: `packages/generate/tsconfig.json`
- Create: `packages/generate/src/index.ts`
- Create: `packages/generate/src/types.ts`

- [ ] **Step 1: Create `package.json`**

Follow the pattern from `packages/format/package.json`. Key fields:
- `name`: `@tourguide/generate`
- `type`: `module`
- `exports`: dual ESM/CJS from `dist/`
- `scripts`: `build` (tsup), `test` (vitest), `lint` (biome)
- `dependencies`: `@tourguide/format` (workspace:*), `ai`, `@ai-sdk/anthropic`, `zod`
- No dependency on `@tourguide/core`

- [ ] **Step 2: Create `tsconfig.json`**

Extend `../../tsconfig.base.json`. Add project reference to `../format`. `rootDir: "src"`, `outDir: "dist"`.

- [ ] **Step 3: Create `src/types.ts`**

Define and export:
- `GenerateOptions`: `{ repoPath: string, baseRef: string, headRef: string, model: LanguageModel, maxSteps?: number, onProgress?: ProgressCallback }`
- `GenerateResult`: `{ tour: Tour, warnings: ValidationWarning[] }` (where `Tour` comes from `@tourguide/format`)
- `ProgressCallback`: `(message: string, detail?: { step?: number, maxSteps?: number }) => void`

- [ ] **Step 4: Create `src/index.ts`**

Re-export types from `types.ts`. Export a placeholder `generateTour` that throws "not implemented". This gets replaced in Task 7.

- [ ] **Step 5: Install dependencies and verify build**

```bash
cd packages/generate && pnpm install
pnpm build
pnpm test  # should pass with no tests
```

- [ ] **Step 6: Register in workspace**

Verify the package is picked up by `pnpm-workspace.yaml` (already glob `packages/*`). Run `pnpm install` from root. Run `pnpm build` from root to verify all packages build.

- [ ] **Step 7: Commit**

```bash
git add packages/generate/
git commit -m "feat(generate): scaffold @tourguide/generate package"
```

---

## Task 2: Git execution helper and fixture repo

**Files:**
- Create: `packages/generate/src/tools/git.ts`
- Create: `packages/generate/tests/helpers/fixture-repo.ts`

- [ ] **Step 1: Implement `execGit` helper**

`src/tools/git.ts` — a thin wrapper around `child_process.execFile` that:
- Runs `git` with given args in a given `cwd`
- Returns stdout as string
- Throws a descriptive error on non-zero exit (include stderr in the error message)
- Has a `maxBuffer` option for large outputs (default 10MB)

- [ ] **Step 2: Implement fixture repo helper**

`tests/helpers/fixture-repo.ts` — exports `createFixtureRepo()` and `cleanupFixtureRepo()`:
- Creates a temp directory
- Initializes a git repo with `git init`
- Creates an initial commit with 2-3 source files (e.g., `src/math.ts` with an `add` function, `src/utils.ts` with a helper, `README.md`)
- Creates a second commit that modifies/adds files (e.g., adds `multiply` to `math.ts`, adds `src/api.ts` that imports from `math.ts`)
- Returns `{ repoPath, baseRef: <sha of commit 1>, headRef: <sha of commit 2> }`
- Cleanup removes the temp directory

Use `execGit` from the git helper to run git commands during setup.

- [ ] **Step 3: Write a smoke test for the fixture**

In any tool test file (e.g., `tests/tools/read-file.test.ts`), write one test that creates the fixture repo, asserts `baseRef` and `headRef` are valid SHAs, and cleans up. This validates the fixture works.

- [ ] **Step 4: Run tests, verify pass**

```bash
cd packages/generate && pnpm test
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(generate): add git exec helper and test fixture repo"
```

---

## Task 3: Tool implementations — readFileAtRef, listDirectory, searchCodebase

**Files:**
- Create: `packages/generate/src/tools/read-file.ts`
- Create: `packages/generate/src/tools/list-dir.ts`
- Create: `packages/generate/src/tools/search.ts`
- Create: `packages/generate/tests/tools/read-file.test.ts`
- Create: `packages/generate/tests/tools/list-dir.test.ts`
- Create: `packages/generate/tests/tools/search.test.ts`

Each tool module exports two things:
1. An `execute` function (pure, testable): `(params, repoPath) => Promise<string>`
2. An AI SDK `tool()` definition that wraps the execute function (created in Task 5)

- [ ] **Step 1: Implement and test `readFileAtRef`**

Implementation: runs `git show ${ref}:${filePath}` via `execGit`. Returns file content as string. Throws clear error if file doesn't exist at ref.

Tests (against fixture repo):
- Read a file that exists at baseRef → returns expected content
- Read a file that was added in headRef → works at headRef, fails at baseRef
- Read a nonexistent file → throws descriptive error

- [ ] **Step 2: Implement and test `listDirectory`**

Implementation: runs `git ls-tree --name-only ${ref} ${dirPath}` via `execGit`. Returns newline-separated list of entries. For the root, omit the dirPath arg.

Tests:
- List root at baseRef → returns known files
- List a subdirectory → returns correct entries
- List at headRef shows new files added in second commit

- [ ] **Step 3: Implement and test `searchCodebase`**

Implementation: runs `rg ${pattern} --no-heading --line-number` in the repo working directory. Returns matched lines. Accepts optional `--glob` filter. Returns empty string if no matches (don't throw on no results).

Tests:
- Search for a function name → finds it with file:line:content format
- Search for nonexistent pattern → returns empty string
- Search with glob filter → only matches in matching files

- [ ] **Step 4: Run all tests, verify pass**

```bash
cd packages/generate && pnpm test
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(generate): implement readFileAtRef, listDirectory, searchCodebase tools"
```

---

## Task 4: Tool implementations — gitLog, gitBlame

**Files:**
- Create: `packages/generate/src/tools/git-log.ts`
- Create: `packages/generate/src/tools/git-blame.ts`
- Create: `packages/generate/tests/tools/git-log.test.ts`
- Create: `packages/generate/tests/tools/git-blame.test.ts`

- [ ] **Step 1: Implement and test `gitLog`**

Implementation: runs `git log --oneline -n ${maxEntries}` with optional `-- ${filePath}`. Default `maxEntries: 20`. Returns log output as string.

Tests:
- Log of whole repo → shows both commits
- Log of a specific file → shows only commits touching that file
- Respects maxEntries limit

- [ ] **Step 2: Implement and test `gitBlame`**

Implementation: runs `git blame -L ${startLine},${endLine} ${filePath}` via `execGit`. Returns blame output as string. Both line params optional (omit `-L` if neither provided).

Tests:
- Blame a known file → returns output with commit hashes and content
- Blame with line range → returns only those lines
- Blame nonexistent file → throws descriptive error

- [ ] **Step 3: Run all tests**

```bash
cd packages/generate && pnpm test
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(generate): implement gitLog and gitBlame tools"
```

---

## Task 5: AI SDK tool definitions

**Files:**
- Create: `packages/generate/src/tools/index.ts`

- [ ] **Step 1: Create AI SDK tool definitions**

`src/tools/index.ts` exports a function `createTools(repoPath: string)` that returns a tools object for `generateText`:

```ts
import { tool } from 'ai';
import { z } from 'zod';
```

Each tool uses `tool({ description, inputSchema: z.object({...}), execute })`. The `execute` functions call the implementations from Tasks 3–4, closing over `repoPath`.

Tool definitions:
- `readFileAtRef`: params `{ ref: string, filePath: string }`
- `searchCodebase`: params `{ pattern: string, glob?: string }`
- `listDirectory`: params `{ ref: string, dirPath?: string }`
- `gitLog`: params `{ filePath?: string, maxEntries?: number }`
- `gitBlame`: params `{ filePath: string, startLine?: number, endLine?: number }`

Write descriptive `description` strings — these are part of the prompt the LLM sees. Be clear about what each tool does and when to use it.

- [ ] **Step 2: Verify build**

```bash
cd packages/generate && pnpm build
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(generate): wire tool implementations into AI SDK tool definitions"
```

---

## Task 6: Prompts and provider resolution

**Files:**
- Create: `packages/generate/src/prompts.ts`
- Create: `packages/generate/src/provider.ts`
- Create: `packages/generate/tests/prompts.test.ts`

- [ ] **Step 1: Write discovery and narration prompts**

`src/prompts.ts` exports:
- `buildDiscoveryPrompt(diff: string)`: returns `{ system: string, prompt: string }`. The system prompt describes the senior-engineer-reviewer role (see design spec section "Call 1: Discovery"). The user prompt includes the raw diff.
- `buildNarrationPrompt(synthesis: string, diff: string)`: returns `{ system: string, prompt: string }`. The system prompt describes the tour-author role (see design spec section "Call 2: Narration"). The user prompt includes the synthesis and the diff for line anchoring.

Key prompt details:
- Discovery system prompt must NOT mention the tourguide format
- Narration system prompt must explain the tour is for PR reviewers, emphasize *why* not *what*, encourage thematic grouping over file-order
- Narration prompt should mention this is a `diff` mode tour and include the baseRef/headRef values

- [ ] **Step 2: Write prompt tests**

Test that:
- Discovery prompt includes the diff in the user message
- Discovery system prompt does not contain "tourguide" or "schema" or "JSON"
- Narration prompt includes both the synthesis and the diff
- Narration system prompt mentions reviewer audience

- [ ] **Step 3: Implement provider resolution**

`src/provider.ts` exports `createModel(provider: string, modelId: string): LanguageModel`:
- If provider is `"anthropic"`, dynamically import `@ai-sdk/anthropic` and return `anthropic(modelId)`
- For other providers, attempt dynamic import of `@ai-sdk/${provider}`. If the import fails, throw a clear error: `"Provider package @ai-sdk/${provider} not installed. Run: pnpm add @ai-sdk/${provider}"`

- [ ] **Step 4: Run tests, verify pass**

```bash
cd packages/generate && pnpm test
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(generate): add prompt construction and provider resolution"
```

---

## Task 7: Discovery and narration pipeline

**Files:**
- Create: `packages/generate/src/discovery.ts`
- Create: `packages/generate/src/narration.ts`

- [ ] **Step 1: Implement `runDiscovery`**

`src/discovery.ts` exports `runDiscovery(options: { model: LanguageModel, diff: string, repoPath: string, maxSteps: number, onProgress?: ProgressCallback }): Promise<string>`

Uses `generateText` with:
- `model` from options
- `system` and `prompt` from `buildDiscoveryPrompt(diff)`
- `tools` from `createTools(repoPath)`
- `stopWhen: stepCountIs(maxSteps)` (import from `ai`)
- `onStepFinish` callback to call `onProgress` with step count

Returns the final `result.text` — the discovery synthesis.

- [ ] **Step 2: Implement `runNarration`**

`src/narration.ts` exports `runNarration(options: { model: LanguageModel, synthesis: string, diff: string, baseRef: string, headRef: string, onProgress?: ProgressCallback }): Promise<Tour>`

Uses `generateText` with:
- `model` from options
- `system` and `prompt` from `buildNarrationPrompt(synthesis, diff)`
- `output: Output.object({ schema: tourSchema })` (import `Output` from `ai`, `tourSchema` from `@tourguide/format`)

Returns `result.output` — the generated Tour object.

The narration call should also inject `generatedBy` fields after generation: `tool: "tourguide"`, `model: <model id>`, `metadata: { baseRef, headRef }`. If the LLM already set `generatedBy`, merge rather than overwrite.

- [ ] **Step 3: Verify build compiles**

```bash
cd packages/generate && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(generate): implement discovery and narration pipeline calls"
```

---

## Task 8: Validation, retry, and main pipeline

**Files:**
- Create: `packages/generate/src/validation.ts`
- Modify: `packages/generate/src/generate.ts` (replace placeholder)
- Create: `packages/generate/tests/validation.test.ts`

- [ ] **Step 1: Implement validation + retry**

`src/validation.ts` exports:
- `validateTour(tour: unknown): ValidationResult` — wraps `validate` from `@tourguide/format`
- `retryNarration(options: { ..., previousErrors: ValidationError[] }): Promise<Tour>` — calls `runNarration` with the validation errors appended to the prompt: "Your previous output had these semantic errors: [JSON list]. Fix them in your next attempt."

- [ ] **Step 2: Write validation tests**

Test against hand-crafted tour objects (not LLM output):
- A valid tour object → returns success
- A tour with a dangling chapter reference → returns failure with specific error
- `retryNarration` builds the correct prompt (mock the narration call, assert the prompt contains the error messages)

Use `MockLanguageModelV3` from `ai/test` to mock the narration call in the retry test.

- [ ] **Step 3: Implement `generateTour`**

`src/generate.ts` — the main pipeline function. Orchestrates:
1. Run `git diff ${baseRef}..${headRef}` via `execGit` to get the raw diff
2. Call `runDiscovery(model, diff, repoPath, maxSteps, onProgress)`
3. Call `runNarration(model, synthesis, diff, baseRef, headRef, onProgress)`
4. Call `validateTour(tour)` — if semantic errors, call `retryNarration` once
5. Return `{ tour, warnings }` on success
6. On retry failure: return the tour anyway with warnings + errors on stderr (best-effort)

Update `src/index.ts` to re-export the real `generateTour`.

- [ ] **Step 4: Run tests, verify pass**

```bash
cd packages/generate && pnpm test
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(generate): implement main generateTour pipeline with validation and retry"
```

---

## Task 9: CLI `generate` command

**Files:**
- Create: `packages/cli/src/commands/generate.ts`
- Modify: `packages/cli/src/cli.ts`
- Modify: `packages/cli/package.json` (add `@tourguide/generate` dependency)
- Create: `packages/cli/tests/generate.test.ts`

- [ ] **Step 1: Add `@tourguide/generate` dependency to CLI**

In `packages/cli/package.json`, add `"@tourguide/generate": "workspace:*"` to dependencies. Run `pnpm install` from root.

- [ ] **Step 2: Implement `generate` command**

`src/commands/generate.ts` — exports an async `generate` function. Handles:
- Resolve `repoPath` from `cwd` (verify it's a git repo by running `git rev-parse --git-dir`)
- Call `createModel(provider, modelId)` from `@tourguide/generate`
- Call `generateTour({ repoPath, baseRef, headRef, model, maxSteps, onProgress })` from `@tourguide/generate`
- `onProgress` callback writes to `process.stderr` (unless `--quiet`)
- On success: write `JSON.stringify(tour, null, 2)` to stdout (or `--output` file)
- On error: write error message to stderr, exit 1
- If result has warnings: write them to stderr

- [ ] **Step 3: Register command in `cli.ts`**

Add the `generate` command to the commander program with options:
- `.requiredOption('--diff <range>', 'Git ref range (e.g., main..HEAD)')`
- `.option('--model <model>', 'Model identifier', 'claude-sonnet-4-20250514')`
- `.option('--provider <name>', 'AI SDK provider', 'anthropic')`
- `.option('--output <path>', 'Write tour to file')`
- `.option('--max-steps <n>', 'Max discovery steps', '25')`
- `.option('--quiet', 'Suppress progress output')`

Parse `--diff` to split on `..` into baseRef and headRef.

- [ ] **Step 4: Write CLI tests**

Test flag parsing and basic wiring (don't call the actual LLM):
- `--diff main..HEAD` correctly splits into baseRef/headRef
- Missing `--diff` flag → exits with error
- `--diff` with invalid format (no `..`) → exits with error
- `--output` writes to file (mock `generateTour` to return a fixture tour)

- [ ] **Step 5: Verify full build**

```bash
cd /Users/nathan/tourguide && pnpm build && pnpm test
```

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(cli): add tourguide generate command"
```

---

## Task 10: Gated LLM integration test

**Files:**
- Create: `packages/generate/tests/generate.integration.test.ts`

- [ ] **Step 1: Write integration test**

Gated behind `TOURGUIDE_TEST_LLM=1` (skip the entire describe block otherwise).

Test flow:
1. Create fixture repo using `createFixtureRepo()`
2. Call `generateTour` with real Anthropic model (`claude-sonnet-4-20250514`), the fixture's baseRef/headRef
3. Assert the result has a valid tour (result.tour is defined)
4. Assert the tour passes `validate()` from `@tourguide/format`
5. Assert `tour.mode === 'diff'`
6. Assert `tour.chapters.length >= 1`
7. Assert `tour.chapters` have steps that reference files from the fixture diff
8. Assert `tour.generatedBy` is populated
9. Clean up fixture repo

- [ ] **Step 2: Run the integration test manually**

```bash
TOURGUIDE_TEST_LLM=1 ANTHROPIC_API_KEY=<key> pnpm --filter @tourguide/generate test -- --testPathPattern integration
```

Verify it produces a valid tour. Inspect the output for quality.

- [ ] **Step 3: Commit**

```bash
git commit -m "test(generate): add gated LLM integration test"
```

---

## Task 11: End-to-end smoke test and cleanup

- [ ] **Step 1: Run the full CLI against the tourguide repo itself**

```bash
cd /Users/nathan/tourguide
pnpm build
ANTHROPIC_API_KEY=<key> node packages/cli/dist/cli.js generate --diff HEAD~3..HEAD
```

Inspect the output. Verify it's valid JSON, passes `tourguide validate`, and makes sense as a tour.

- [ ] **Step 2: Run the full test suite**

```bash
cd /Users/nathan/tourguide && pnpm check
```

All existing tests still pass. New tests pass. Build succeeds. Lint passes.

- [ ] **Step 3: Fix any issues found**

Address any lint errors, type errors, or test failures.

- [ ] **Step 4: Final commit**

```bash
git commit -m "chore(generate): cleanup and verify end-to-end"
```
