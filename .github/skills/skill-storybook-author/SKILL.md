---
name: skill-storybook-author
summary: Write component stories and interaction checks.
description: Author Storybook stories for your @workspace/ui components to the story standard — one concept per story, JSDoc-driven autodocs, a per-component a11y + interaction + token-load baseline — so the Storybook MCP is a reliable, grounded source of component truth for agents. Use after Storybook is set up. Requires React + Vite Storybook and the Storybook MCP.
---

# Storybook author

Author and maintain Storybook stories for the project's `@workspace/ui` components. This skill is a
**thin orchestrator over Storybook's native tooling** (the agent setup, the MCP, the Vitest test
project) — it does **not** reimplement them. Its value is injecting the **story standard** so the
generated stories are a reliable source of truth for agents, not generic defaults.

The same component set powers the generated Figma library (`skill-figma-generate`). Both read
`packages/ui/src/components/*` directly — keep stories and the Figma library **1:1** by covering the
same components; do not invent a separate manifest.

## Preflight (stop with remediation if missing)

Storybook is the mechanism; this skill assumes it is already set up. Before authoring, verify — and if
anything is missing, stop and tell the user how to fix it, rather than half-working:

1. **Storybook is installed** — `packages/ui/.storybook/main.ts` exists (React + Vite). If not:
   ask the design-system maintainer to provision Storybook and its dependencies and scripts.
   If this system publishes a Storybook setup item, discover its exact name in the system's
   own registry and follow its setup instructions; do not assume an upstream item is appropriate.
2. **Native AI setup** — run `bunx storybook ai setup` (Storybook 10+) to configure the MCP for your
   agent automatically. This replaces manual MCP fragment wiring for new setups. If the command is
   unavailable (older Storybook), fall back to the reference fragment at `.agents/storybook-mcp.claude.json`.
3. **The Vitest Storybook project** — `packages/ui/vitest.config.ts` with the `storybookTest` plugin,
   and `bunx playwright install chromium` has been run. Needed for the test loop.
4. **The Storybook MCP active** — the dev server must be running (`bun run storybook`,
   `http://localhost:6006`) for MCP tools (`get-documentation-for-story`, etc.) to respond.

This mirrors the Figma skills' independence: preflight-check, never bundle.

## The story standard

Author every story to this bar (per Storybook's AI best practices + Merkle conventions):

- **One concept per story.** Don't mix sizes + variants in one story. Name stories for the _why_
  (when/why to use a pattern), not just the _what_.
- **JSDoc everywhere.** A component summary stating purpose (e.g. Button for actions vs Link for
  navigation) + a description on every prop. This drives autodocs and the agent manifests.
- **Prop extraction** via `react-docgen-typescript` (set in `.storybook/main.ts`; the plain `react-docgen` default reports unions as `any`).
- **Manifest curation.** Tag anti-pattern / edge stories `!manifest` so agents reading the MCP aren't
  given misleading context. Keep MDX static + explicit (generated values don't surface in manifests).
- **Per-component baseline.** An interaction test (`play`) for critical flows + an a11y check + a
  token-load assertion (reuse the installed `Foundations/Token validation` pattern).
- **Icon-only stories.** A component that accepts an icon but no text must clear the inherited
  `children` default — otherwise the story template injects a placeholder that the component rejects:
  ```ts
  args: { children: undefined }
  ```
  Without this, `test-storybook` crashes with a prop validation error on every icon-only variant.
- **Registry + Figma parity.** Cover the `@workspace/ui` components 1:1; keep aligned with the
  generated Figma library — one IP, two outputs.

## Process

1. **Enumerate** the installed components under `packages/ui/src/components/*`. Each gets one
   `<name>.stories.tsx` beside it (co-located: `packages/ui/src/components/<name>/<name>.stories.tsx`).
   Skip any that already have stories meeting the standard. **1:1 coverage target:** every component
   directory must have a `.stories.tsx`; verify by listing both sets and diffing — surface any
   gap to the user before proceeding.
2. **Read the component** — props (the TS types), variants, slots, and any JSDoc. If JSDoc is missing,
   add it to the component first (purpose summary + per-prop descriptions) — it's the backbone of the
   standard.
3. **Author stories** — one concept each, with `play` + a11y where it matters. Use the token decorator
   that the installed Storybook setup already provides (don't re-wrap tokens).
4. **Run the self-healing loop** — generate → `run-story-tests` (Storybook MCP at
   `http://localhost:6006/mcp`) → read failures → fix → re-test, until green. Then
   `bun run test-storybook` for the full a11y + interaction pass. If the MCP is unavailable, start
   Storybook first (`bun run storybook` in `packages/ui`) and re-read §Preflight.
5. **Verify** 1:1 coverage and story quality via the MCP (`get-documentation-for-story`) — that's the
   acceptance check that an agent will read them correctly. Re-diff components vs stories to confirm
   the coverage gap is closed.

## Out of scope

- Setting Storybook up from scratch — that's the project's Storybook setup, not this skill.
- A shared story ↔ Figma-node manifest — the components are the shared truth; revisit only if a
  concrete cross-link need appears.
