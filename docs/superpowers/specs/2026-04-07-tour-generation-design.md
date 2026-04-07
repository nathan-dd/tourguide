# Tour Generation System Design

> Design spec for the tourguide generation system. Covers the full vision (G1–G6) with M2 scoped to G1: single-model agentic generation from git diffs.

---

## Context

tourguide has a stable foundation: `@tourguide/format` (Zod schemas, semantic validation, JSON Schema), `@tourguide/core` (loading, traversal, graph, resolver), and `@tourguide/cli` (validate, play, summary). The format supports both `diff` and `codebase` tour modes, including `generatedBy` provenance and optional `pattern` fields for resilient anchoring.

No generation code exists yet. This spec designs the system that produces tours from real PRs.

## Audience and Quality Bar

Generated tours are for **PR reviewers**. A reviewer receives the tour before or during review to understand the changes — what changed, why, how the pieces connect, and what deserves attention.

Tours must be **usable as-is** — no editing expected. If the tool produces confusing or wrong tours, people stop trusting it. This makes prompt design and agentic discovery critical: the LLM needs deep understanding of the changes to produce a tour worth reading.

## Architecture

### Package Structure

New package: `packages/generate/` (`@tourguide/generate`)

**Dependencies:**

- `ai` (Vercel AI SDK)
- `@ai-sdk/anthropic` (default provider)
- `@tourguide/format` (schema, validation, JSON Schema)

No dependency on `@tourguide/core` — generation produces tours, it doesn't consume them.

The CLI gets a `generate` command that's a thin wrapper: parse flags, call the library, pipe output. The library owns the agentic loop, tool definitions, prompt construction, and output validation.

### Data Flow

```
CLI (parse flags, resolve refs)
  → generate library (agentic loop)
    → AI SDK: discovery call (generateText + tools)
      → tools execute against local git repo
    ← discovery synthesis (free-form text)
    → AI SDK: narration call (generateText + Output.object + tourSchema)
    ← tour object (Zod-validated)
  → semantic validation via @tourguide/format
  → stdout or --output file
```

The generate library exposes a main function — `generateTour(options)` — that takes diff refs, repo path, and model config, and returns a validated tour object. This keeps the library usable programmatically for future CI integration, VS Code, or other consumers.

### Why Not "Structural Analysis"

The original roadmap described a two-phase pipeline: deterministic structural analysis (import tracing, call graph, file role classification) followed by LLM narration. We're not doing this.

The LLM is better at understanding code relationships than any heuristic parser we'd build. A custom structural analysis risks misleading the LLM by pruning useful context or imposing structure the LLM then feels obligated to follow. And for codebase mode (G4), there's no diff to bound the scope — a structural analyzer would need to decide what matters before the LLM has seen anything, which is the hard part.

Instead, the LLM gets the raw diff and tools to explore the codebase autonomously. It decides what's relevant.

### LLM Abstraction: Vercel AI SDK

The generation code never calls provider APIs directly. It uses the Vercel AI SDK (`ai` package), which provides a unified interface across Anthropic, OpenAI, Google, Mistral, and others.

**Why the AI SDK over direct SDKs or a custom abstraction:**

- Tool use normalization across providers is genuinely hard. Anthropic's native tool use, OpenAI's function calling, and Google's function declarations all become the same interface. This is critical for the agentic loop.
- `generateText` with tools + `stopWhen: stepCountIs(N)` handles the discovery agent loop. `generateText` with `output: Output.object({ schema })` handles the narration call with schema enforcement.
- Provider packages are separate (`@ai-sdk/anthropic`, `@ai-sdk/openai`). Users only install what they use. Adding a provider is a dependency, not a code change.

## The Two-Call Pipeline

### Call 1: Discovery (generateText + tools)

The discovery model receives the raw diff and a system prompt. Its job is to deeply understand the changes by exploring the codebase autonomously.

**System prompt intent:** "You are a senior engineer reviewing a PR. Understand what changed, why, how the pieces relate, and what a reviewer needs to know. Use your tools to follow threads of understanding. When you're satisfied, write a synthesis."

The discovery prompt has no knowledge of the tourguide format. It's pure comprehension — this keeps the model focused on understanding rather than prematurely structuring output.

**Tools:**


| Tool             | Implementation                 | Purpose                                             |
| ---------------- | ------------------------------ | --------------------------------------------------- |
| `readFileAtRef`  | `git show ref:path`            | Read file content at a specific git ref             |
| `searchCodebase` | ripgrep over working tree      | Find symbols, usages, definitions                   |
| `listDirectory`  | `ls` / `git ls-tree` at a ref  | Orient in project structure, discover related files |
| `gitLog`         | `git log --oneline` for a path | Understand history and context                      |
| `gitBlame`       | `git blame` for a file range   | Attribution and change context                      |


All tools are read-only and execute against the local git repo.

**Stopping:** The AI SDK's `stopWhen: stepCountIs(N)` parameter caps tool-use rounds (default: 25). The model naturally converges — once it understands the changes, it stops calling tools and produces its synthesis.

**Output:** The final text message — a free-form synthesis of what changed, why, how the pieces connect, and what deserves attention. This is internal to the pipeline; the user never sees it.

### Call 2: Narration (generateText + Output.object + tourSchema)

The narration model receives:

1. A system prompt explaining its role as a tour author
2. The discovery synthesis
3. The raw diff (for precise file/line anchoring)
4. The tour Zod schema (enforced via `generateObject`)

**System prompt intent:** "You are writing a guided tour of a PR for a code reviewer. Organize the material into an engaging walkthrough. Explain *why*, not just *what*. Group by conceptual theme, not file order. Skip boilerplate. Output must match the schema."

**Schema enforcement:** `generateText` with `output: Output.object({ schema: tourSchema })` from the AI SDK. This replaces the deprecated `generateObject` API. The AI SDK enforces the schema at the provider level. The existing Zod schema — including discriminated unions, nested chapters/steps/annotations/connections — is passed directly.

**Provenance:** The generated tour's `generatedBy` field is populated automatically: `tool: "tourguide"`, `version` from `package.json`, `model` from the narration model identifier, and `metadata` with the diff range and discovery step count.

**Why two calls, not one:**
The discovery model thinks like a reader — curious, exploratory, following threads. The narration model thinks like a writer — organizing, structuring, making editorial decisions. One combined prompt leads to the model cutting exploration short to start structuring, or over-exploring because it hasn't committed to a structure. Separating the roles gives each call a clear objective.

Note: while the AI SDK supports combining tools + structured output in a single `generateText` call, the separation into two calls is intentional for the reasons above. The discovery call uses tools only; the narration call uses `Output.object()` only.

## CLI Interface

```
tourguide generate --diff base..head [options]
```


| Flag                | Default                    | Purpose                                       |
| ------------------- | -------------------------- | --------------------------------------------- |
| `--diff <range>`    | (required)                 | Git ref range: `main..HEAD`, `abc123..def456` |
| `--model <model>`   | `claude-sonnet-4-20250514` | Model identifier (AI SDK format)              |
| `--provider <name>` | `anthropic`                | AI SDK provider name                          |
| `--output <path>`   | stdout                     | Write tour to file instead of stdout          |
| `--max-steps <n>`   | `25`                       | Cap on discovery tool-use rounds              |
| `--quiet`           | off                        | Suppress stderr progress                      |
| `--verbose`         | off                        | Show LLM text and tool calls on stderr        |


**API keys** follow each provider's convention via environment variables (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.). The AI SDK handles this per provider. The CLI loads `.env` files from the current directory via `dotenv`, so you can store keys in a gitignored `.env` file rather than exporting them in your shell.

**Other providers:** `@ai-sdk/anthropic` ships as a dependency. Other providers require the user to install the corresponding SDK package (e.g., `pnpm add @ai-sdk/openai`). If `--provider` is set but the package isn't installed, fail with a clear message explaining which package to install.

**Output discipline:** Tour JSON goes to stdout. Everything else (progress, warnings) goes to stderr. This keeps the output pipeable: `tourguide generate --diff main..HEAD | jq .`

**Progress on stderr:** "Discovering codebase... (step 4/25)", "Generating tour...", "Validating output...". Generation can take 30–60 seconds; the user should know something is happening.

**CI-friendliness:** No TTY requirement, no interactive prompts, `--quiet` for clean CI logs, clean JSON on stdout, non-zero exit codes on failure.

## Validation, Retry, and Error Handling

**Validation pipeline:** After the narration call produces a tour, run it through `@tourguide/format`'s `validate()` to catch semantic errors (dangling chapter references, broken connection endpoints, invalid annotation refs) that the Zod schema alone can't express.

**Retry:** If semantic validation fails, retry the narration call once, appending the validation errors: "Your previous output had these errors: [list]. Fix them." One retry only. The discovery phase is not re-run (it's expensive and the problem is in narration).

**Error behavior:**


| Error                              | Behavior                                                   |
| ---------------------------------- | ---------------------------------------------------------- |
| Git failure (bad refs, not a repo) | Fail fast, clear message, exit 1                           |
| API key missing                    | Fail fast: "ANTHROPIC_API_KEY not set", exit 1             |
| API error (rate limit, network)    | Fail with provider error message, exit 1                   |
| Semantic validation failure        | Retry narration once with error context                    |
| Retry also fails                   | Output invalid tour to stdout + warnings to stderr, exit 1 |


**Best-effort escape hatch:** When retry fails, we have a tour that's structurally valid (matched the Zod schema) but has semantic issues. Rather than discarding 60 seconds of work, output it with stderr warnings listing the errors. The user can manually fix the issues or discard it.

## Testing Strategy

**Principle:** Test everything except the LLM call deterministically. Test LLM integration with a small number of focused e2e tests.

**Unit tests (no LLM):**

- **Tool implementations** — `readFileAtRef`, `searchCodebase`, `listDirectory`, `gitLog`, `gitBlame` tested against a fixture git repo (small repo created in test setup with known commits)
- **Prompt construction** — Given a diff and options, assert the prompts include the right content
- **Validation/retry logic** — Given a tour with semantic errors, assert retry appends errors correctly; assert best-effort path outputs with warnings
- **CLI flag parsing** — Assert flag combinations produce the right config

**Integration tests (real LLM, gated):**

- Gated behind `TOURGUIDE_TEST_LLM=1`. Skipped by default — run manually or in a dedicated CI job with API keys.
- 2–3 tests against the fixture repo: generate a tour from a known diff, assert the output passes `validate()`, assert it has chapters and steps referencing files in the diff.
- Assert **structural correctness**, not narrative quality. The pipeline should produce a valid tour anchored to the right files — not necessarily a beautifully written one.

**Fixture repo:** A small git repository created in test setup with 2–3 commits producing a known diff (e.g., "add a user model and an API endpoint that uses it"). Reused across tool tests and integration tests.

## Generation Milestones

The full generation vision is sliced into milestones. Project-level M2 = G1.

### G1: Single-model agentic generation (= M2)

The full pipeline ships end-to-end:

- `tourguide generate --diff base..head` with discovery → narration → validation
- All five tools, single model for everything
- Vercel AI SDK, Anthropic default, any provider usable via `--provider`/`--model`
- `packages/generate/` as standalone library, CLI as thin wrapper
- Validation + retry + best-effort output
- Stderr progress, CI-friendly, `--output` and `--quiet`
- Unit tests + gated LLM integration tests

### G2: Model tiering

The discovery phase becomes a two-tier system:

- A **frontier model** (Opus-class) orchestrates discovery — it sees the diff, formulates targeted questions, and synthesizes findings
- **Workhorse subagents** (Sonnet/Haiku-class) execute the questions — they receive a focused question + file/search scope, read the code, and return targeted summaries
- The frontier model never reads 2000-line files directly; it gets 200-token summaries of exactly what it asked about

CLI flags: `--discovery-model`, `--narration-model` (can be different providers).

### G3: Feedback loop

`--feedback "missed the auth middleware changes"` flag. The narration call receives the previous output + feedback and produces an improved version. Discovery is skipped by default (reuse the synthesis), optionally re-run with `--rediscover`.

### G4: Codebase mode

`tourguide generate --files src/api/ src/models/`. Same discovery loop, seeded with file contents instead of a diff. Output uses `mode: "codebase"` in the tour schema.

### G5: Large diff handling

Chunked discovery for PRs exceeding context windows. Multiple discovery passes with a merged synthesis. Produces a coherent single tour.

### G6: Conversational generation

Interactive session where the agent asks clarifying questions mid-discovery. Requires TTY — not CI-compatible (separate interaction mode).

### Mapping to project roadmap

- **M2** = G1
- **M4** (Deepen Generation) = G2 + G4 + G5 + pattern anchoring
- G3 and G6 extend beyond the current roadmap

