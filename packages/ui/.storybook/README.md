# Storybook workshop

The Storybook 10 workshop for a scaffolded project's `@workspace/ui` package — Vite builder, the
token decorator, the Vitest browser-test project, the Storybook MCP, and a token-load validation story.

## What it installs

Into `packages/ui/`:

- `.storybook/main.ts` — React + Vite config; a11y, docs, vitest, and MCP addons
- `.storybook/preview.tsx` + `preview.css` — the token decorator (sets `data-brand`/`data-foundation`/`data-theme`) and the token-cascade import
- `.storybook/vitest.setup.ts` + `vitest.config.ts` — the browser test project
- `src/__storybook__/Welcome.mdx` + `TokenValidation.stories.tsx` — a getting-started page and the token-chain canary (excluded from the component manifest)
- `.storybook/AGENTS.md` + `.agents/storybook-mcp.claude.json` — MCP guidance + a reference registration fragment

The `add_items` scaffold step's `wireStorybook` patch adds the Storybook devDependencies and the
`storybook` / `build-storybook` / `test-storybook` scripts to `packages/ui/package.json` (which
the UI package owns, so they can't ship as static files).

## Why `packages/ui` (not `apps/`)

Stories sit 1:1 next to components, and the dev server keeps its fixed `:6006` so the Storybook MCP URL
is stable — `packages/` is not touched by the port-assignment step that pins `apps/` ports.

## Use

```bash
bun run storybook         # dev server at http://localhost:6006 (MCP at /mcp)
bun run build-storybook   # static build
bun run test-storybook    # interaction + a11y tests (needs: bunx playwright install chromium)
```

Author stories to the story standard with the installed `skill-storybook-author` skill. Rename
`@workspace` to your own scope at scaffold time.

## Native AI setup

Storybook 10+ ships native AI agent tooling. To activate it:

```bash
cd packages/ui && bunx storybook ai setup
```

This command configures the Storybook MCP (registers the `@storybook/addon-mcp` endpoint) for your
agent automatically. The MCP config path is:
- Claude Code: `.claude/mcp.json` → `storybook` server entry
- VS Code Copilot: `.vscode/mcp.json` → `storybook` server entry
- The reference fragment (`.agents/storybook-mcp.claude.json`) shipped by this item is the canonical
  backup if the native command doesn't cover your agent.

After setup, the Storybook dev server at `http://localhost:6006` exposes the MCP endpoint at
`http://localhost:6006/mcp` — your agent reads component docs, stories, and prop tables from there.
