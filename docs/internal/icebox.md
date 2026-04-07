# tourguide — Icebox

Parked and deferred ideas. Items here are worth remembering but not worth building now. When a milestone picks up an icebox item, move it to the roadmap and remove it from here. When a new idea comes up that's out of scope, add it here.

---

## Format & Data Model

| Idea | Target | Notes |
|------|--------|-------|
| CodeTour `.tour` importer | v0.2+ | Import existing CodeTour files into `.tourguide` format. Linear tours become single-chapter tours. |
| Tour versioning / staleness detection | Parked | Detect when source code has changed enough that a tour's step anchors are broken. Could use `pattern` fields + git history. Eventually important but not urgent. |
| Bidirectional tour ↔ PR comments | Parked | Sync tour annotations with GitHub PR review comments. Complex integration, unclear value vs. effort. |

## Visualization & UX

| Idea | Target | Notes |
|------|--------|-------|
| Miller columns / Finder-style drilldown | v0.3 | Vertically split editors: left = high-level modules, middle = files/classes, right = annotated code. Fights VS Code's editor layout model — deferred to avoid implementation risk. |
| Minimap overlay | v0.3 | Color the VS Code minimap to show which regions of a file are part of the tour. |
| Standalone HTML export | v0.2+ | Generate a self-contained HTML file for sharing tours with non-VS Code users. Similar to what alexanderop/walkthrough does. |
| Tour diffing | Parked | Compare two tours of the same codebase (before/after a refactor). Niche use case. |

## Generation

| Idea | Target | Notes |
|------|--------|-------|
| Incremental "go deeper" regeneration | v0.2+ | From a tour step, ask the agent to expand that area with more detail. Generates a sub-tour or adds steps. |
| Context-aware generation using project conventions | v0.2+ | Read CLAUDE.md / AGENTS.md / project docs to inform tour narration. E.g., "this project uses a hexagonal architecture, so explain in those terms." |
| Cost-stratified generation (multi-model) | v0.3 | Cheap model for structural analysis, expensive model for narration. Partially addressed in M4 with `--analysis-model` / `--narration-model`, but full cost optimization (e.g., batch processing, caching) is future work. |
| Project-specific tour templates | v0.3 | Pre-defined tour structures per framework. E.g., "for Django features, always trace URL routing → view → serializer → model → migration." |

## Workflow Integration

| Idea | Target | Notes |
|------|--------|-------|
| GitHub Action for auto-generation on PR | v0.2+ | Automatically generate a `.tourguide` file when a PR is opened. Post a comment with a link to the tour. |
| "Tour this PR" button in VS Code | v0.2+ | A button in VS Code's SCM view that generates and opens a tour for the current branch's changes. |
| Shareable HTML export | v0.2+ | (See Visualization section above — same idea, listed in both original categories.) |

## Exploratory / Wild Ideas

| Idea | Target | Notes |
|------|--------|-------|
| Voice narration (TTS) | Parked | Read tour descriptions aloud. Fun, low priority. Accessibility angle could be compelling. |
| "Time travel" mode | v0.3 | Step through a feature's evolution commit-by-commit, with the tour updating at each commit. |
| Collaborative tours (multi-author) | v0.3 | Multiple people annotate the same tour. Requires conflict resolution, author attribution. |
| "What would break" annotations | v0.3 | For each step, the generator explains what would break if this code were removed or changed. Dependency-aware. |
| Mental model quiz | Parked | After completing a tour, quiz the user on key concepts. Too gamified for the primary audience (tech leads). |
