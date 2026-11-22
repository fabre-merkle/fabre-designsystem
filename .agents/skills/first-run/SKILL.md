---
name: first-run
description: Set up a freshly scaffolded project.
---

# First-run setup skill

Sets up a freshly scaffolded fabre-DesignSystem project from scratch, in order.
Run this skill after cloning the repo for the first time.

## Step 1 — Install dependencies

Run from the repo root:

```bash
bun install
```

Confirm all packages resolved without errors before continuing.

## Step 2 — Set up Tokens Studio

Run the deterministic local setup first:

```bash
bun run setup:first-run
```

Then read and follow `.github/skills/skill-tokens-studio/SKILL.md`. If your agent registers
repository skills, you may invoke `skill-tokens-studio` instead. The skill asks once whether to
create a Tokens Studio project or use an existing project, then imports the prepared DTCG batches
through the Tokens Studio MCP, creates themes, writes `.studio.json`, and runs CSS exports.

First inspect `packages/tokens/.studio.json` for an existing project and source ref.
Verify that project through a read-only MCP request; do not create a replacement merely because
this is the first local run. If it is missing, inaccessible or ambiguous, ask the owner before
creating or selecting a project.

Do not use the Studio CLI to push tokens: it supports pull/export only. After verified staging,
continue with the remaining setup steps; approve the pending Studio changes as a final action.

## Step 3 — Verify Storybook

Run Storybook and confirm components render with correct token values:

```bash
bun run storybook
```

Navigate to the TokenValidation story and confirm no unresolved token warnings.
If tokens appear missing, ensure the token cascade CSS was imported correctly (check `packages/ui/.storybook/preview.css` layer declarations).

## Step 4 — Generate your Figma library

Use the `skill-figma-library` skill to generate components and bind design token variables.

Invoke: `skill-figma-library`

## Step 5 — Wire Code Connect

Code Connect requires a reviewed generation manifest at `.agents/figma.json` matching the
published Figma library and this project's component contract. The scaffold does not create
that file. Obtain it from the library's supported generation workflow or the library owner;
do not invent component node IDs. If it is unavailable, stop this step and resolve that
prerequisite before generating or publishing mappings.

After confirming the manifest, generate and commit the `.figma.ts` templates:

```bash
test -f .agents/figma.json || { printf '%s\n' 'Missing reviewed Figma generation manifest'; exit 1; }
bun run figma:connect
bun run figma:connect:check
```

The CI workflow runs the check on every PR (no token needed) and publishes on main when
`FIGMA_ACCESS_TOKEN` is configured (`gh secret set FIGMA_ACCESS_TOKEN`). Publishing needs a Dev
or Full seat on a Professional, Organization or Enterprise plan, a published Figma team library, and a
token with the Code Connect (write) and File content (read) scopes.

For a mapping the contract does not cover, install the official Figma plugin for your agent and use
its `figma-code-connect` skill.

**Claude Code:** `claude plugin install figma@claude-plugins-official`
**Cursor:** `/add-plugin figma`
**VS Code / GitHub Copilot:** the scaffold already registered `figma` in `.vscode/mcp.json` (when VS Code MCP was selected)

## Step 6 — Start Fumadocs

Start the docs site and verify the theme renders correctly:

```bash
cd apps/docs && bun run dev
```

Open http://localhost:3001 and confirm the colour theme, navigation, and docs pages load.

> **Note:** You may see a webpack warning about `dynamic import(url.href) in fumadocs-mdx`.
> This is cosmetic/upstream — it does not affect builds or page rendering.
> Restart dev if MDX changes don't appear after editing `source.config.ts`.

## Done

All setup steps complete. Run the project normally:

```bash
bun run dev
```

