# Design Spec: tourguide Driving Documents

**Date:** 2026-04-06
**Status:** Draft
**Scope:** Two documents — a public vision document and an operational milestone roadmap — plus archived internal references.

---

## Context

tourguide is a monorepo project that produces three independent systems communicating through a shared `.tourguide` file format:

1. **Format specification** — JSON schema, TypeScript types, validation (`@tourguide/format`)
2. **VS Code extension** — rich interactive visualization and navigation
3. **Agent toolkit** — CLI + generation pipeline that produces `.tourguide` files from code (`@tourguide/cli`)

The project already has two packages implemented (`@tourguide/format`, `@tourguide/core`) with schema, validation, loading, graph, traversal, and resolver functionality. The remaining work spans CLI scaffolding, tour generation, a VS Code extension, and publishing.

The project spec was written before the codebase existed. Now that the foundation is built, we need two driving documents:

- A **public vision document** that communicates what tourguide is and where it's going — for contributors, potential users, and anyone evaluating the project.
- An **operational milestone roadmap** that drives execution — scoped for solo development with AI coding agents, where each milestone is a self-contained chunk of work (1–3 days) with enough context for an agent to pick up and execute.

The original project spec is archived for reference, and parked brainstorming ideas are preserved as an icebox.

---

## File Layout

```
docs/
├── vision.md                    # Public: what tourguide is and where it's going
├── roadmap.md                   # Operational: milestones for execution with AI agents
└── internal/
    ├── original-spec.md         # Archived: the full project spec as originally written
    └── icebox.md                # Parked ideas for future exploration
```

---

## Document 1: Vision (`docs/vision.md`)

### Purpose

The public face of the project. A senior engineer reads this and understands what tourguide is, why it exists, and how it works — in about 5 minutes. Confident tone, not marketing-speak. Links to the roadmap for execution status.

### Outline

1. **What is tourguide?**
  One-paragraph elevator pitch. The problem: CTOs and tech leads who work with AI agents lose mental models of their codebases — they can't estimate work, make architectural calls, or stay effective. The solution: structure-aware guided tours that provide an interactive, drilldown-capable understanding experience. The key differentiator: the `.tourguide` format is the universal contract — any agent generates, any viewer consumes.
2. **Three independent systems**
  Architecture diagram showing the decoupling principle. The format spec is the contract. The VS Code extension consumes tours. The agent toolkit produces them. They communicate only through `.tourguide` files. This separation means any LLM can generate valid tours, and alternative viewers/generators can exist without coupling.
3. **The `.tourguide` format**
  Narrative explanation (not a schema dump) of what's in a tour file: metadata (title, description, mode), overview (summary, Mermaid diagram, file map), chapters (narrative grouping), steps (code-anchored points of attention with semantic kinds), annotations (persistent code-anchored metadata), and connections (typed edges between steps/annotations). Include a small annotated example. Link to the JSON Schema for the full spec.
4. **The VS Code experience**
  Described from the user's perspective — what it feels like to open a tour, see the overview graph, start guided play, read the narrative panel, notice gutter decorations, and navigate via connections. Not implementation details.
5. **The agent toolkit**
  How tours get generated. Two-phase approach: structural analysis (deterministic extraction of diff/code structure) then narration (LLM with full creative agency to produce an engaging, understandable tour). CLI interface: `generate --diff`, `generate --files`, `validate`, `play`, `summary`. Cross-tool compatibility table.
6. **Landscape and differentiation**
  Brief positioning vs CodeTour (flat/linear, abandoned), Amp Walkthroughs (coupled to Amp), AI code reviewers (bug-catching, not comprehension). Why tourguide is different: works on diffs or full code, structure-aware, drilldown navigation, comprehension-focused, tool-agnostic.
7. **Target user and success metric**
  Primary: technical leads and CTOs of small-to-medium teams using AI coding agents, who need to maintain architectural understanding without becoming the review bottleneck. Success: understand a medium-complexity PR (10–20 files, 500+ lines) in under 10 minutes, retaining enough to estimate follow-on work and spot architectural concerns.
8. **Project status**
  Current state in one sentence. Link to `docs/roadmap.md`.

---

## Document 2: Roadmap (`docs/roadmap.md`)

### Purpose

The operational execution plan. Designed to be consumed by an AI coding agent at the start of a session: "Here's where we are, here's what you're working on, here's what matters."

This is a **living document**. As milestones complete, their cards collapse to one-line summaries, the Mermaid diagram updates, and the "current" marker advances. The roadmap always reflects the true state of the project.

### Structure

**Part 1: Status overview**
A Mermaid dependency diagram showing all milestones as nodes with directed edges for dependencies. Color-coded: green (done), blue (current), gray (upcoming). Below the diagram, a one-line summary table: milestone name, status, one-sentence goal.

**Part 2: Active and upcoming milestone cards**
Each milestone is a self-contained section with:

```
## M[n]: [Name]

**Status:** done | in-progress | upcoming
**Depends on:** M[x], M[y]
**Goal:** One sentence — what this delivers and why.

### Acceptance Criteria
- [ ] Specific, testable criterion
- ...

### Key Decisions
Settled choices an agent must respect. Each decision includes the rationale ("because...").

### Context
What an agent needs to know to start work: codebase state, relevant files/packages,
gotchas, links to vision doc sections.
```

**Part 3: Completed milestones**
Collapsed to one-line summaries. Full cards move to a `<details>` block or are trimmed. The roadmap always focuses on current and upcoming work.

### Milestone Breakdown

#### M0: Foundation ✅

**Goal:** Establish the `.tourguide` format schema and core consumption library.

Already implemented. `@tourguide/format` provides Zod schemas, inferred TypeScript types, semantic validation (referential integrity), and JSON Schema generation. `@tourguide/core` provides tour loading/parsing, connection graph building, linear traversal with progress tracking, and source range/pattern resolution.

**Known gaps to address in M1:** `buildGraph` only indexes top-level `connections` (not per-step), traversal doesn't guard against empty chapters/tours, format may need adjustments discovered during CLI/generation work.

---

#### M1: CLI Scaffold

**Goal:** Stand up `@tourguide/cli` with consumption commands and harden the foundation.

**Acceptance Criteria:**

- `tourguide validate <file>` reports schema + referential integrity errors with clear output
- `tourguide play <file>` walks the tour step-by-step in the terminal (Enter to advance, q to quit, shows chapter/step context)
- `tourguide summary <file>` prints overview summary, chapter list, file map
- `buildGraph` merges per-step connections into the graph (M0 gap fixed)
- Traversal handles empty chapters and empty tours gracefully
- Proper `--help`, `--version`, non-zero exit codes on errors

**Key Decisions:**

- **CLI framework: commander.js.** Standard, lightweight, great docs. No need for heavier alternatives (yargs, oclif) at this scale.
- **Terminal output: chalk for colors, pipe-friendly.** No heavy TUI framework (ink, blessed). Output should be readable when piped to a file or another tool. Disable color when stdout is not a TTY.
- **Play mode: Enter-to-advance, not full TUI.** Displays current chapter title, step number/total, step title, description, file reference. Simple and reliable — fancy terminal UI is a distraction from the core value.
- **Package identity:** `@tourguide/cli` on npm, binary name `tourguide`.
- **Foundation fixes live here** because the CLI exercises the full format+core stack. This is the natural place to discover and fix gaps.

**Context:** The CLI package doesn't exist yet. Create `packages/cli/` following the same patterns as `packages/format/` and `packages/core/` (tsup build, vitest tests, biome linting). The CLI depends on both `@tourguide/format` and `@tourguide/core` as workspace dependencies.

---

#### M2: Tour Generation

**Goal:** `generate --diff` produces valid tours from real PRs. First real-world test.

**Acceptance Criteria:**

- `tourguide generate --diff base..head` produces a valid `.tourguide` file
- Generated tour includes: overview with summary and file map, chapters grouping related changes, steps anchored to diff hunks with descriptions, connections between related steps
- Output passes `tourguide validate` with no errors
- Successfully generates a meaningful, understandable tour from a real PR
- LLM provider and model are configurable

**Key Decisions:**

- **Two-phase pipeline:** (1) Structural analysis — deterministic, no LLM. Parse git diff, extract hunks, identify files and their roles, trace function/module relationships, build a raw graph of what changed and how pieces connect. (2) Narration — LLM takes the structural analysis as input and produces the tour.
- **Narration LLM has full creative agency.** The structural analysis provides raw material (hunks, relationships, file roles), but the narrating LLM is an author, not a formatter. It may reorganize material into chapters that don't follow file order. It may skip or de-emphasize uninteresting changes. It may group changes by conceptual theme rather than file boundary. It may add architectural context the structural analysis can't provide. The goal is an engaging, understandable tour — not a mechanical description of each hunk.
- **LLM integration: Anthropic Claude API first.** Model configurable via `--model` flag or `TOURGUIDE_MODEL` env var. Start with a single model for the full narration; multi-model (cheap for structure, expensive for narration) is M4.
- **Prompt includes the JSON Schema** so the LLM knows the exact target format. The prompt also includes the structural analysis output and clear instructions about the tour's purpose (comprehension, not bug-catching).
- **Output: stdout by default, `--output` for file.** No streaming — generate the full tour, validate it, then output. If validation fails, report errors and exit non-zero.

**Context:** This is the most complex milestone. The structural analysis needs git integration (parsing diff output, reading file contents at specific refs). The narration needs LLM API integration. Both are new capabilities. The `examples/sample.tourguide` file shows the target format shape.

---

#### M3: VS Code Extension MVP

**Goal:** Rich interactive visualization of `.tourguide` files. The "aha" moment.

**Acceptance Criteria:**

- Extension activates when a `.tourguide/` directory exists in the workspace
- Tour Explorer: tree view in sidebar listing available tours, chapters within each tour, steps within each chapter
- Overview panel: webview showing tour summary, file map with relevance indicators, Mermaid diagram (clickable nodes navigate to chapters/steps)
- Guided play: next/prev step keyboard shortcuts, editor auto-navigates to the step's file and highlights the range
- Narrative panel: bottom webview showing current chapter title + progress, step title, step description rendered as markdown
- Gutter decorations: colored dots on annotated lines (color = annotation category), hover shows annotation text

**Key Decisions:**

- **Overview panel: VS Code webview.** Mermaid rendered client-side via mermaid.js loaded in the webview. Webview communicates with the extension via message passing for navigation events.
- **Narrative panel: webview in bottom panel area.** Not an OutputChannel — needs rich markdown rendering, chapter context display, and eventually interactive elements. A webview panel placed in the bottom editor group.
- **Tree view: standard TreeDataProvider API.** Three levels: tour → chapter → step. Icons indicate step kind.
- **Bundling: esbuild.** Fast extension load times. `@tourguide/format` and `@tourguide/core` are bundled into the extension (not listed as extension dependencies).
- **No external runtime dependencies** beyond mermaid.js in the webview sandbox. No telemetry. No network calls.

**Context:** The `packages/vscode/` directory doesn't exist yet. VS Code extension development uses the `@types/vscode` package and the `vsce` tool for packaging. The extension should follow VS Code's extension guidelines for activation events, contribution points, and packaging. Test with both hand-crafted `.tourguide` files and (if M2 is complete) real generated tours.

---

#### M4: Deepen Generation

**Goal:** Codebase mode, smarter prompts, resilient anchoring, cost optimization.

**Acceptance Criteria:**

- `tourguide generate --files src/api/ src/models/` works (codebase mode — explore existing code, not a diff)
- Generated steps include regex `pattern` fields for resilience against line number drift
- Narration quality is noticeably better: descriptions explain *why* code exists and *what would break*, not just what it does
- Multi-model option: `--analysis-model` / `--narration-model` flags for cost optimization
- Large diffs handled gracefully (chunking by file group if needed, merged into a coherent tour)

**Key Decisions:**

- **Codebase mode: file listing + content analysis, no git diff.** The structural analysis reads file contents directly, identifies key components (entry points, models, handlers, tests), and traces relationships.
- **Pattern generation: extract unique code patterns near each step's range.** The generation pipeline produces regex patterns as anchors, so tours survive minor edits to the source.
- **Multi-model support:** Structural analysis can use a cheaper/faster model, narration uses a more capable one. Both configurable. Default is single model for simplicity.

**Context:** Builds directly on M2's generation pipeline. The two-phase architecture should make this mostly about expanding the structural analysis (codebase mode) and refining prompts (pattern generation, narration quality).

---

#### M5: Deepen VS Code

**Goal:** Full navigation, file explorer integration, persistent annotations.

**Acceptance Criteria:**

- From any step, "jump to related" shows outgoing connections and navigates to the target step/annotation
- File explorer shows decorations for tour files: color/badge indicating relevance (primary, secondary, context)
- Breadcrumb bar shows navigation path: overview → chapter → step. Click any breadcrumb to jump back.
- Ghost annotations: when not in guided play mode, annotated lines still show subtle (reduced opacity) gutter decorations and hover content
- Keyboard shortcuts are user-configurable via VS Code keybinding settings

**Key Decisions:**

- **File decorations: FileDecorationProvider API.** Color and badge based on the `relevance` field in the tour's file map.
- **Connections panel:** When a step has outgoing connections, display them as a list with type labels (calls, imports, triggers...) and one-click navigation. Could be inline in the narrative panel or a separate panel.
- **Ghost annotations: reduced-opacity gutter decorations + hover.** Always active when a tour is loaded, regardless of whether guided play is running. This is what makes annotations a persistent layer over the code.

**Context:** Builds on M3's extension. Most features use well-documented VS Code APIs (FileDecorationProvider, custom keybindings). The breadcrumb implementation depends on whether we use a custom webview element or VS Code's built-in breadcrumb extension points.

---

#### M6: Publish & Distribute

**Goal:** npm packages, VS Code Marketplace, zero-install CLI, CI pipeline.

**Acceptance Criteria:**

- `@tourguide/format`, `@tourguide/core`, `@tourguide/cli` published to npm
- `npx tourguide generate --diff main..HEAD` works for zero-install usage
- VS Code extension published to the Marketplace and installable
- CI pipeline: test + lint + build on every PR, publish triggered by git tag
- README.md is polished: project description, quickstart, screenshots/GIFs of the VS Code experience, links to docs
- `docs/vision.md` linked from the README as the detailed project description

**Key Decisions:**

- **npm org: `@tourguide`.** Extension marketplace ID: `tourguide.tourguide` (or similar, subject to availability).
- **CI: GitHub Actions.** Separate workflows for PR validation (test/lint/build) and release (publish to npm + marketplace on tag push).
- **Publish is manual** — triggered by tagging a release, not automatic on merge to main. This keeps control over what ships.
- **Changelog:** `CHANGELOG.md` in the repo root, updated with each milestone's notable changes.

**Context:** All three library packages (`format`, `core`, `cli`) use tsup for building. The VS Code extension uses esbuild + vsce for packaging. Publishing requires npm tokens and VS Code marketplace tokens configured as GitHub Actions secrets.

---

## Document 3: Archived Spec (`docs/internal/original-spec.md`)

The full project specification as originally written, preserved as-is with a header noting it's an archived document superseded by `docs/vision.md` and `docs/roadmap.md`.

## Document 4: Icebox (`docs/internal/icebox.md`)

Parked and deferred ideas from the brainstorming process, organized by category:

- **Format & Data Model** — e.g., CodeTour importer, tour versioning/staleness detection
- **Visualization & UX** — e.g., Miller columns (v0.3), minimap overlay (v0.3)
- **Generation** — e.g., incremental "go deeper" regeneration (v0.2), context-aware generation using project conventions (v0.2), cost-stratified generation (v0.3)
- **Workflow Integration** — e.g., GitHub Action for auto-generation (v0.2), "Tour this PR" VS Code button (v0.2), shareable HTML export (v0.2)
- **Exploratory** — e.g., voice narration, time-travel mode, collaborative tours, tour templates, "what would break" annotations, tour diffing, mental model quiz

Each item includes its version/priority tag and a one-line description. Living document — new ideas get added here, picked-up ideas get removed.