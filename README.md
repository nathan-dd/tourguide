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
pnpm --filter @tourguide/cli exec tourguide generate --diff main..HEAD

# Write to a file with verbose logging
pnpm --filter @tourguide/cli exec tourguide generate --diff main..HEAD --output tour.tourguide --verbose

# Use a different model
pnpm --filter @tourguide/cli exec tourguide generate --diff main..HEAD --model claude-sonnet-4-20250514 --provider anthropic
```

### Validate a tour file

```bash
pnpm --filter @tourguide/cli exec tourguide validate tour.tourguide
```

### Print a tour summary

```bash
pnpm --filter @tourguide/cli exec tourguide summary tour.tourguide
```

### Play through a tour interactively

```bash
pnpm --filter @tourguide/cli exec tourguide play tour.tourguide
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

