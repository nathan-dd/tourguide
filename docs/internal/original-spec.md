# tourguide — Original Project Specification (Archived)

> **This document is archived.** It captures the project specification as originally written, before implementation began. The current project vision is in [`docs/vision.md`](../vision.md) and the execution roadmap is in [`docs/roadmap.md`](../roadmap.md).
>
> Preserved for historical reference and as a source of context for decisions made during the design phase.

---

## Problem Statement

Technical leads and CTOs who work with AI coding agents and developer teams face a growing bottleneck: they need to review code not just for quality, but to maintain mental models of how features work. Without understanding the code, they lose the ability to estimate work, make architectural decisions, and stay effective. Current tools either catch bugs (AI code reviewers) or provide flat, linear walkthroughs (CodeTour). Nothing provides an interactive, structure-aware, drilldown-capable guided experience that helps a technical leader *understand* code efficiently.

## Project Name

**tourguide**

## License

MIT

## Language

TypeScript throughout (monorepo).

---

## Architecture: Three Independent Systems

tourguide is explicitly designed as three decoupled systems that communicate through a shared file format. This separation is a core architectural principle, not an implementation detail.

### System 1: `.tourguide` Format Specification

A JSON file format that describes a guided code understanding experience. This is the universal contract between generators and visualizers.

### System 2: `tourguide` VS Code Extension

A VS Code extension that consumes `.tourguide` files and provides a rich interactive visualization and navigation experience. This is where humans consume tours.

### System 3: `tourguide-generate` Agent Toolkit

Tooling that produces `.tourguide` files from code. This includes a CLI, prompt specifications, and eventually CI integrations. Any LLM agent (Claude Code, Cursor, Codex, Copilot) should be able to generate valid `.tourguide` files.

---

## System 1: `.tourguide` Format Specification

### Why Not Extend CodeTour?

CodeTour's `.tour` format is a flat ordered list of file+line pointers with markdown descriptions. It lacks:

- Graph structure (no connections between steps, no typed edges, no parent/child)
- Hierarchy/scoping (no drilldown levels, no zoom)
- Diff awareness (no before/after, no base ref vs head ref)
- Semantic metadata (no step kind/category)
- Overview/summary concept (no narrative that isn't tied to a file+line)
- Separation of annotations from narrative

Extending it would mean the base format becomes irrelevant baggage. Instead, tourguide defines its own format with a CodeTour importer for backwards compatibility.

### Format Structure

The `.tourguide` format must support the following structural elements:

#### Tour Metadata
- `title` — tour name
- `description` — brief description of what this tour covers
- `mode` — either `"diff"` or `"codebase"`
  - `diff` mode includes `baseRef` and `headRef` (git refs)
  - `codebase` mode optionally includes a single `ref`
- `version` — format version string
- `generatedBy` — optional metadata about what tool/agent generated this tour

#### Overview
A dedicated top-level object (not a step) that provides the entry point:
- `summary` — high-level text description of the changes or feature area
- `diagram` — optional Mermaid diagram specification for the visual graph
- `fileMap` — a list of files involved in the tour, each with a brief description of why it matters and a `relevance` indicator (e.g., primary, secondary, context)

#### Chapters (Narrative Structure)
The narrative is organized into ordered "chapters" (or acts). Each chapter:
- Has a `title` and `summary`
- Contains an ordered list of `steps`
- Represents a logical grouping (e.g., "Request routing", "Data validation", "Persistence")
- Chapters provide the hierarchy: the overview level is the list of chapters; the detail level is the steps within a chapter

#### Steps
Each step represents a single point of attention in the code:
- `id` — unique identifier within the tour
- `file` — relative file path
- `range` — start and end positions (line + character), not just a single line
- `pattern` — optional regex alternative to line numbers for resilience
- `title` — short step title
- `description` — markdown description explaining this code
- `kind` — semantic tag: `entry-point`, `model`, `handler`, `serializer`, `config`, `side-effect`, `test`, `migration`, `utility`, `type-definition`, etc.
- `chapter` — reference to parent chapter
- `connections` — list of outgoing typed edges (see below)
- `annotationRefs` — list of annotation IDs this step references

#### Annotations
Separate from steps. Code-anchored metadata that exists independently of the narrative:
- `id` — unique identifier
- `file` — relative file path
- `range` — start and end positions
- `pattern` — optional regex for resilience
- `content` — markdown text
- `kind` — same taxonomy as step kinds
- `category` — visual category for color coding: `modified`, `entry-point`, `data-flow`, `side-effect`, `context`, etc.

Annotations are "always visible" decorations. When following the guided tour, steps reference annotations. When exploring manually, annotations still appear as gutter decorations and hover content.

#### Connections
Typed edges between steps and/or annotations:
- `from` — source step or annotation ID
- `to` — target step or annotation ID
- `type` — one of: `calls`, `imports`, `configures`, `tests`, `triggers`, `inherits`, `returns-to`
- `description` — optional explanation of the relationship

Connections power the graph visualization in the overview and enable "jump to related" navigation.

### Format Principles
- JSON format (not YAML — easier to validate, parse, and generate programmatically)
- File extension: `.tourguide`
- Storage location: `.tourguide/` directory in the workspace root (analogous to `.tours/`)
- The format must be fully self-describing: an agent reading the schema should be able to narrate the tour conversationally without any special tooling
- The format must be versionable: include a `$schema` reference and `version` field

---

## System 2: VS Code Extension

### Core Visualization Features (MVP)

#### Overview Screen (Entry Point)
- A webview panel showing the tour's overview
- Renders the Mermaid diagram (if present) as a clickable graph — nodes represent files/modules/chapters, edges represent connections
- Displays the summary text
- Shows the file map with color coding
- Clicking a node in the graph starts the tour at the corresponding chapter/step

#### Guided Play Mode
- Sequential advancement through chapters and steps
- Keyboard shortcuts for next/previous step (and next/previous chapter)
- Auto-play option with configurable pace
- Pause/escape to manual exploration at any time
- Resume from where you left off
- Current position clearly indicated in both the narrative panel and the editor

#### Narrative Panel (Bottom Panel)
- A VS Code panel (bottom of the editor) that displays the current chapter and step description
- Markdown rendering including inline diagrams
- Synced to the current tour position
- Shows chapter context: title, summary, progress through the chapter
- Remains visible regardless of which file the user navigates to

#### Editor Decorations
- **Gutter decorations**: colored dots/icons on annotated lines. Color indicates the annotation category (modified, entry-point, data-flow, side-effect, etc.)
- **Hover content**: hovering over a gutter decoration shows the annotation text
- **"Ghost" annotations**: when in manual exploration mode (away from guided tour), annotated code still shows subtle decorations so context persists

#### File Explorer Decorations
- Badge/color files that are part of the tour
- Heat-style coloring: primary files (heavily annotated) vs. secondary files (touched) vs. context files
- Visible in the standard VS Code Explorer tree

#### Breadcrumb Trail
- When drilling down (overview → chapter → step → related step), a breadcrumb bar shows the navigation path
- Click any breadcrumb to jump back to that level
- Enables non-linear exploration while maintaining orientation

#### Navigation
- From any step, "jump to related" using connections (e.g., "see the serializer this view calls")
- Step list in the tour tree view (sidebar) with chapter grouping
- Click any step in the tree to navigate directly

### Future Visualization Features (Post-MVP)

#### Miller Columns / Finder-Style Drilldown (v0.3)
- Vertically split editors from left (higher level) to right (lower level)
- Left column: high-level modules/areas
- Middle column: files/classes within the selected module
- Right column: actual code with annotations
- This requires working with VS Code's editor layout model and is deferred to avoid implementation risk in MVP

#### Minimap Overlay
- Color the VS Code minimap to show which regions of a file are part of the tour

#### Other Future Features
- Standalone HTML export for sharing with non-VS Code users
- Tour diffing (compare two tours before/after a refactor)
- Collaborative annotations (multiple people annotate the same tour)

---

## System 3: Agent Toolkit

### Design Principle: Loose Coupling

The toolkit produces `.tourguide` files. It does not care about the visualizer. Any LLM agent that can read the format schema can generate valid files. The toolkit is a convenience, not a requirement.

### Generation Approach: Two-Phase

1. **Structural analysis**: Extract the code graph — files, functions, connections, diff hunks. Identify what matters and how pieces relate.
2. **Narration**: Write human-friendly narrative over the graph. Explain not just *what* the code does but *why* it exists and what would break without it.

### Input Modes

- **Diff mode**: `git diff base..head` → analyze changed files, trace connections between changes, generate tour
- **Codebase mode**: a set of files or a feature name → trace through code, identify key components, generate tour

### CLI Interface

```
tourguide generate --diff main..HEAD        # diff mode
tourguide generate --files src/api/ src/models/  # codebase mode
tourguide validate my-tour.tourguide        # validate against schema
tourguide play my-tour.tourguide            # terminal walkthrough
tourguide summary my-tour.tourguide         # print overview + file map
```

### Distribution

- `npx tourguide generate --diff main..HEAD` for zero-install usage
- npm package: `@tourguide/cli`

### Cross-Tool Compatibility

| Tool | Format | Generator | Visualizer |
|------|--------|-----------|------------|
| **Cursor / VS Code** | reads | can invoke | full VS Code extension experience |
| **Claude Code** | reads/writes | primary use case (generates files) | terminal fallback via `tourguide play` CLI; can also read `.tourguide` and narrate conversationally |
| **Codex** | writes | primary use case (generates files in CI/async) | none — CI validation via `tourguide validate` |

### Future Agent Features (Post-MVP)

- GitHub Action for auto-generation on PR open
- Context-aware generation using CLAUDE.md / project conventions
- Incremental "go deeper on this step" regeneration
- Cost-stratified generation (cheap model for structure, expensive model for narrative)
- Project-specific tour templates (e.g., "for Django features, always show URL routing → view → serializer → model")

---

## Monorepo Structure

```
tourguide/
├── packages/
│   ├── format/          # .tourguide JSON schema, TypeScript types, validation utilities
│   │                    # Publishable as @tourguide/format
│   ├── core/            # Tour traversal, step resolution, graph navigation logic
│   │                    # Shared between CLI and VS Code extension
│   │                    # Publishable as @tourguide/core
│   ├── cli/             # Terminal commands: generate, validate, play, summary
│   │                    # Publishable as @tourguide/cli (or just `tourguide`)
│   └── vscode/          # VS Code extension
│                        # Publishable to VS Code Marketplace as `tourguide`
├── docs/                # Format specification documentation
├── examples/            # Example .tourguide files
├── package.json         # Workspace root
├── pnpm-workspace.yaml  # pnpm workspace config
├── tsconfig.base.json   # Shared TypeScript config
└── README.md
```

All packages are TypeScript. Workspace managed with pnpm.

---

## Existing Tools & Landscape Context

### Closest to tourguide's Vision
- **Amp Shareable Walkthroughs** (Sourcegraph) — interactive clickable diagrams with drilldown, but tightly coupled to Amp agent
- **alexanderop/walkthrough** — open-source reimplementation of Amp's walkthrough as a Claude Code skill; generates self-contained interactive HTML
- **CodeMap** (academic prototype) — hierarchical codebase visualization aligned with cognitive flow (research paper, not a product)

### Adjacent but Different
- **CodeTour** (Microsoft, effectively abandoned) — manual linear step-by-step tours in VS Code
- **Tour de Code AI** — AI-enhanced fork of CodeTour, still linear
- **PocketFlow Tutorial-Codebase-Knowledge** — generates static markdown tutorials from repos
- **CodeRabbit, Greptile, Graphite Agent** — AI PR reviewers focused on bug-catching, not comprehension

### Key Differentiation
tourguide is unique because it:
1. Works on **diffs** (PR review) or **full code** (feature understanding)
2. Is **structure-aware** — adapts to code architecture, not linear walkthrough
3. Has **drilldown navigation** — overview → chapter → step → related code
4. Targets **comprehension** as the goal, not bug-catching
5. Is **tool-agnostic** — the format is the contract; any agent generates, any viewer consumes

---

## Target User

Primary: Technical leads and CTOs of small-to-medium engineering teams who use AI coding agents and need to maintain architectural understanding without becoming the review bottleneck.

Secondary: Any developer onboarding to an unfamiliar codebase or feature area.

## Success Metric

The primary user can understand a medium-complexity PR (10-20 files, 500+ lines changed) in under 10 minutes using a tourguide tour, retaining enough understanding to estimate follow-on work and identify architectural concerns.
