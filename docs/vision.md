# tourguide

**Structure-aware guided tours for code understanding.**

---

## What is tourguide?

Technical leads and CTOs who work with AI coding agents face a growing bottleneck: they need to review code not just for quality, but to maintain mental models of how features work. Without understanding the code, they lose the ability to estimate work, make architectural decisions, and stay effective. Current tools either catch bugs (AI code reviewers) or provide flat, linear walkthroughs (CodeTour). Nothing provides an interactive, structure-aware, drilldown-capable guided experience that helps a technical leader *understand* code efficiently.

tourguide solves this. It generates rich, navigable tours of code changes or feature areas — with chapters, steps, annotations, connections, and overview diagrams — so you can understand a medium-complexity PR in minutes instead of hours. The `.tourguide` file format is the universal contract: any AI agent can generate tours, any viewer can consume them.

---

## Architecture: Three Independent Systems

tourguide is built as three decoupled systems that communicate through a shared file format. This separation is a core architectural principle.

```
┌──────────────────────┐     ┌───────────────────┐     ┌──────────────────────┐
│   Agent Toolkit      │     │  .tourguide file  │     │   VS Code Extension  │
│                      │────▶│                   │────▶│                      │
│  Structural analysis │     │  The universal    │     │  Overview graph      │
│  + LLM narration     │     │  contract         │     │  Guided play         │
│                      │     │                   │     │  Narrative panel     │
│  CLI: generate,      │     │  JSON format      │     │  Decorations         │
│  validate, play      │     │  with schema      │     │  Navigation          │
└──────────────────────┘     └───────────────────┘     └──────────────────────┘
```

**The format is the contract.** The agent toolkit produces `.tourguide` files. The VS Code extension consumes them. Neither knows about the other. This means:

- Any LLM agent (Claude Code, Cursor, Codex, Copilot) can generate valid tours by reading the JSON Schema.
- Alternative viewers can be built without touching the generator.
- Tours are portable, versionable, and inspectable — they're just JSON files.

---

## The `.tourguide` Format

A `.tourguide` file is a JSON document that describes a guided code understanding experience. Files live in a `.tourguide/` directory in the workspace root and are structured around these concepts:

### Tour Metadata

Every tour has a `title`, `description`, format `version`, and a `mode` — either **diff** (comparing two git refs) or **codebase** (exploring existing code).

### Overview

The entry point. A high-level `summary` of what the tour covers, an optional `diagram` (Mermaid specification for visual rendering), and a `fileMap` listing every file in the tour with a description and relevance level (`primary`, `secondary`, or `context`).

### Chapters

The narrative structure. Ordered logical groupings — "Request Routing", "Data Validation", "Persistence" — each with a title, summary, and an ordered list of steps. Chapters provide the zoom levels: the overview is the chapter list, the detail is the steps within.

### Steps

Each step is a single point of attention in the code: a file, a range (start/end line and character), a title, a markdown description, and a semantic `kind` (`entry-point`, `handler`, `model`, `serializer`, `config`, `side-effect`, `test`, `migration`, `utility`, `type-definition`). Steps can include an optional `pattern` (regex) for resilience against line number drift, outgoing `connections` to other steps, and references to `annotations`.

### Annotations

Code-anchored metadata that exists independently of the narrative. Where steps are part of the guided tour, annotations are persistent decorations — they appear as gutter markers and hover content even when you're not following the tour. Each annotation has a `category` (`modified`, `entry-point`, `data-flow`, `side-effect`, `context`) that determines its visual color coding.

### Connections

Typed edges between steps and/or annotations that power graph visualization and "jump to related" navigation. Connection types: `calls`, `imports`, `configures`, `tests`, `triggers`, `inherits`, `returns-to`.

### Example

Here's a minimal tour showing the key concepts:

```json
{
  "$schema": "./node_modules/@tourguide/format/tourguide.schema.json",
  "version": "1.0",
  "title": "User authentication flow",
  "description": "How login requests are handled end-to-end",
  "mode": "codebase",
  "overview": {
    "summary": "The auth flow starts at the /login endpoint, validates credentials against the user model, and issues a JWT token.",
    "diagram": "graph LR; A[POST /login] --> B[AuthHandler]; B --> C[UserModel]; B --> D[TokenService]",
    "fileMap": [
      { "file": "src/routes/auth.ts", "description": "Login endpoint definition", "relevance": "primary" },
      { "file": "src/handlers/auth.ts", "description": "Request handling and validation", "relevance": "primary" },
      { "file": "src/models/user.ts", "description": "User lookup and credential check", "relevance": "secondary" },
      { "file": "src/services/token.ts", "description": "JWT generation", "relevance": "context" }
    ]
  },
  "chapters": [
    {
      "id": "ch-routing",
      "title": "Request Routing",
      "summary": "How the login request enters the system and reaches the handler.",
      "steps": [
        {
          "id": "step-endpoint",
          "file": "src/routes/auth.ts",
          "range": { "start": { "line": 12, "character": 0 }, "end": { "line": 18, "character": 1 } },
          "pattern": "router\\.post\\('/login'",
          "title": "Login endpoint",
          "description": "POST /login is defined here. The route delegates to `handleLogin` — note the `validateBody` middleware that ensures the request has `email` and `password` fields before the handler runs.",
          "kind": "entry-point",
          "chapter": "ch-routing",
          "connections": [
            { "from": "step-endpoint", "to": "step-handler", "type": "calls", "description": "Delegates to the auth handler" }
          ],
          "annotationRefs": []
        }
      ]
    }
  ],
  "annotations": [],
  "connections": [
    { "from": "step-endpoint", "to": "step-handler", "type": "calls" }
  ]
}
```

The full JSON Schema is published as part of `[@tourguide/format](packages/format/tourguide.schema.json)`.

---

## The VS Code Experience

When you open a workspace with `.tourguide` files, the extension activates and adds a **Tour Explorer** to the sidebar listing available tours.

**Opening a tour** presents the **overview panel** — a webview showing the tour's summary, the file map with color-coded relevance, and a rendered Mermaid diagram where nodes are clickable entry points into the tour.

**Guided play** advances through the tour step by step. Keyboard shortcuts move between steps and chapters. The editor auto-navigates to each step's file and highlights the relevant range. A **narrative panel** at the bottom of the editor shows the current chapter context, step title, and description rendered as rich markdown — visible regardless of which file you're looking at.

**Annotations** appear as colored dots in the editor gutter. Their color reflects their category: entry points, data flow, side effects, modifications, context. Hovering reveals the annotation text. These decorations persist even when you're not in guided play — they form a persistent understanding layer over the code.

**Navigation** is non-linear. From any step, you can jump to related code via connections ("see the model this handler calls"), click any step in the Tour Explorer tree, or use the breadcrumb trail to move between zoom levels (overview → chapter → step → related step).

**File explorer decorations** show which files are part of the tour and how central they are — primary files are visually prominent, context files are subtle.

---

## The Agent Toolkit

The CLI tool generates tours and provides utilities for working with `.tourguide` files.

### Generation: Two-Phase Pipeline

Tour generation follows a two-phase approach:

**Phase 1: Structural analysis** — deterministic, no LLM. Parse the git diff (or file listing), extract hunks, identify files and their roles, trace function and module relationships, build a raw graph of what changed and how the pieces connect. This phase produces the factual skeleton.

**Phase 2: Narration** — the LLM takes the structural analysis as input and produces the tour. The narrating LLM has full creative agency: it reorganizes material into chapters based on conceptual themes (not file order), decides what deserves attention and what to skip, adds architectural context the structural analysis can't provide, and writes descriptions that explain *why* code exists — not just what it does. The structural analysis is "what changed." The narration is "here's how to understand it."

### CLI Interface

```
tourguide generate --diff main..HEAD          # Generate tour from a PR/diff
tourguide generate --files src/api/ src/models/  # Generate tour for a feature area
tourguide validate my-tour.tourguide          # Validate against schema
tourguide play my-tour.tourguide              # Step-by-step terminal walkthrough
tourguide summary my-tour.tourguide           # Print overview and file map
```

Zero-install: `npx tourguide generate --diff main..HEAD`

### Cross-Tool Compatibility


| Tool                 | Reads format      | Generates tours     | Visualizes tours                                                  |
| -------------------- | ----------------- | ------------------- | ----------------------------------------------------------------- |
| **Cursor / VS Code** | Yes               | Via CLI             | Full extension experience                                         |
| **Claude Code**      | Yes               | Primary use case    | Terminal via `tourguide play`; conversational narration from JSON |
| **Codex / CI**       | Yes               | Async generation    | Validation via `tourguide validate`                               |
| **Any LLM agent**    | Yes (JSON Schema) | Yes (schema-guided) | —                                                                 |


---

## Landscape and Differentiation

**CodeTour** (Microsoft, effectively abandoned) provides manual, linear step-by-step tours. No graph structure, no hierarchy, no diff awareness, no generation.

**Amp Shareable Walkthroughs** (Sourcegraph) offer interactive clickable diagrams with drilldown — the closest to tourguide's vision — but are tightly coupled to the Amp agent and not an open format.

**AI code reviewers** (CodeRabbit, Greptile, Graphite) focus on bug-catching and code quality, not comprehension. They tell you what's wrong, not how to understand what's there.

tourguide is different because it:

1. Works on **diffs** (PR review) or **full code** (feature understanding)
2. Is **structure-aware** — chapters, connections, annotations, not a flat list
3. Has **drilldown navigation** — overview → chapter → step → related code
4. Targets **comprehension** as the goal, not bug-catching
5. Is **tool-agnostic** — the format is the contract; any agent generates, any viewer consumes

---

## Target User

**Primary:** Technical leads and CTOs of small-to-medium engineering teams who use AI coding agents and need to maintain architectural understanding without becoming the review bottleneck.

**Secondary:** Any developer onboarding to an unfamiliar codebase or feature area.

**Success metric:** Understand a medium-complexity PR (10–20 files, 500+ lines changed) in under 10 minutes, retaining enough understanding to estimate follow-on work and identify architectural concerns.

---

## Project Status

tourguide is in active development. The format specification and core library are implemented; the CLI, generation pipeline, and VS Code extension are in progress. See the [roadmap](roadmap.md) for current status and milestones.

### Monorepo Structure

```
tourguide/
├── packages/
│   ├── format/     # @tourguide/format — JSON schema, types, validation
│   ├── core/       # @tourguide/core — loading, traversal, graph, resolution
│   ├── cli/        # @tourguide/cli — generate, validate, play, summary
│   └── vscode/     # VS Code extension
├── docs/           # Vision, roadmap, specs
├── examples/       # Example .tourguide files
└── ...
```

All packages are TypeScript. Workspace managed with pnpm. MIT licensed.