# tourguide

Guided code review generation and visualization system. Generate rich, narrated tours of pull requests using LLMs, then explore them interactively in the terminal or (soon) VS Code.

## Prerequisites

- Node.js >= 20
- pnpm (`corepack enable` to use the version pinned in the repo)

## Installation

```bash
git clone <repo-url> && cd tourguide
pnpm install
pnpm build
```

Then make the `tourguide` command available globally:

```bash
# One-time setup: configure pnpm's global bin directory and add it to PATH
pnpm setup
source ~/.zshrc   # or ~/.bashrc / ~/.bash_profile

# Link the CLI into the global bin
cd packages/cli && pnpm link --global
```

Verify:

```bash
tourguide --version
```

After this, `tourguide` is a live symlink to `packages/cli/dist/cli.js`. Running `pnpm build` from the repo root is enough to pick up code changes — no re-linking needed.

## Configuration

The CLI reads API keys from environment variables. The easiest way to set them is a `.env` file in the project root:

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

Other providers (`openai`, `google`, etc.) use their own env vars (`OPENAI_API_KEY`, etc.) and require installing the corresponding AI SDK package (e.g. `pnpm add @ai-sdk/openai`).

## Usage

### Generate a tour from a PR

```bash
# Basic usage — outputs tour JSON to stdout
tourguide generate --diff main..HEAD

# Write to a file with verbose logging
tourguide generate --diff main..HEAD --output tour.tourguide --verbose

# Use a different model
tourguide generate --diff main..HEAD --model claude-sonnet-4-6 --provider anthropic
```

### Validate a tour file

```bash
tourguide validate tour.tourguide
```

### Print a tour summary

```bash
tourguide summary tour.tourguide
```

### Play through a tour interactively

```bash
tourguide play tour.tourguide
```

## Packages


| Package               | Description                                                                |
| --------------------- | -------------------------------------------------------------------------- |
| `@tourguide/format`   | Zod schemas, TypeScript types, semantic validation, JSON Schema generation |
| `@tourguide/core`     | Tour loading, traversal, connection graph, source resolution               |
| `@tourguide/generate` | LLM-backed tour generation (discovery + narration pipeline)                |
| `@tourguide/cli`      | CLI commands: `validate`, `summary`, `play`, `generate`                    |


## Development

```bash
pnpm check    # build + test + lint
pnpm test     # tests only
pnpm lint     # lint only
```

