# Storybook author skill

An agent skill that authors Storybook stories for your `@workspace/ui` components to the **story
standard**, so the Storybook MCP becomes a reliable, grounded source of component truth for agents.

Installs to the canonical `.agents/skills/skill-storybook-author/` path. The scaffold links this
skill into `.claude/skills/` and `.vscode/prompts/`, and copies it into `.github/skills/`.

## Requires

- Storybook configured in the project (React + Vite, `packages/ui/.storybook`)
- The Vitest Storybook project + `bunx playwright install chromium`
- The Storybook MCP registered + the dev server running (`bun run storybook`)

The skill **preflight-checks** these and stops with remediation if any are missing — it never bundles
Storybook itself.

## What it does

Enumerates `packages/ui/src/components/*`, authors one story file per component (one concept per story,
JSDoc-driven autodocs, a per-component a11y + interaction + token-load baseline), and runs the
generate → test → fix loop to green. Keeps stories 1:1 with the components that also power the
generated Figma library.
