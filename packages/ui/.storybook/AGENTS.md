# Storybook — agent guidance

This package has a Storybook workshop with the **Storybook MCP** (`@storybook/addon-mcp`) enabled.

**Before composing or changing UI, consult the Storybook MCP** for grounded, accurate component
context — props, usage, and existing stories — instead of guessing from source:

- `list-all-documentation` / `get-documentation` — components, props, and when to use each
- `get-documentation-for-story` — a specific story's props + code
- `run-story-tests` — interaction + a11y tests (use the generate → test → fix loop)

Start the server with `bun run storybook` (serves at `http://localhost:6006`; MCP at
`http://localhost:6006/mcp`). Register it once with your agent via the Editor MCP item for your
editor — `@focus/mcp-claude-code` / `@focus/mcp-vscode` — the scaffold merges the `storybook` server into
`.mcp.json` / `.vscode/mcp.json` automatically when Storybook is installed. (Same path as the Figma MCP registration.)

When you author new stories, follow the **story standard** (see the `skill-storybook-author`
skill): one concept per story, JSDoc on the component + every prop, a per-component a11y + interaction
baseline, and `!manifest` on anti-pattern stories so this MCP stays a clean source of truth.
