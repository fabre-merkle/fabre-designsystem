# `@focus/skill-tokens-studio` — Tokens Studio MCP + CLI skill

Agent skill that drives the **Tokens Studio MCP** and the **`@tokens-studio/studio-cli`** to
manage a scaffolded project's token pipeline: initial push, CSS export setup, re-pulls, and
CLI config refresh.

Ships `SKILL.md` → `~/.agents/skills/skill-tokens-studio/SKILL.md`. Referenced from:
- The scaffold completion screen (tokens-studio step).
- `packages/tokens/TOKENS-STUDIO.md` in generated projects.
- The generated `README.md` (initial project push prompt).

## What the skill covers

| Section | Trigger |
|---|---|
| **Initial project push** | First time after scaffolding |
| **Re-pull tokens** | After editing in Studio UI |
| **Refresh CLI config** | Project ID changed / `.studio.json` drifted |
| **Add to existing project** | Tokens Studio added post-scaffold |

## Required setup (one-time)

1. Tokens Studio MCP configured in `.mcp.json` / `.vscode/mcp.json` (merged automatically by the scaffold when an editor MCP item is selected).
2. Run `bun run setup:first-run` from the project root. It installs dependencies, bootstraps the CLI,
   and prepares the MCP import payload. The CLI is pull/export only; the initial import uses MCP.
3. Auth: `studio auth login` (device flow) for local dev, or `TOKENS_STUDIO_TOKEN` service token for CI.
