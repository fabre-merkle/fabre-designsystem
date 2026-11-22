# `@focus/skill-figma-generate`

Generate a project's **Figma component library from its code** (`@workspace/ui`), bound to the
project's Tokens Studio variables — real, themed, self-documented Figma components, one per page.
Agent-driven (drives the **official Figma MCP** via `use_figma`); validated end-to-end across all
component archetypes (prop-grid · state · composite · slots). See `SKILL.md` for the full rules.

## Install

```bash
shadcn add @focus/skill-figma-generate
```

Lands at `.claude/skills/skill-figma-generate/` (`SKILL.md` + `lib/` + `utils/typography-to-figma.ts`)
— read natively by Claude Code, GitHub Copilot and Cursor, so no linking step is needed.

## Deterministic by construction — one contract, two materializers

Generation is a **pure planner over the compiled V2 generation contract**
(`.agents/figma-generation-contract.json`, the same artifact the Figma plugin walks), not LLM
improvisation — `lib/`:

- `artifact.ts` · `parseGenerationArtifact(text)` — reads the artifact and fails loudly, with
  remediation, when it is absent or a version the skill does not read. No fallback to source inference.
- `plan.ts` · `generateComponentPlan(component, artifact, options)` → a serializable, byte-identical `ComponentPlan`:
  every component set the contract declares (one per split value or shape, else one), each Building
  Block's hidden sets, the focus ring layer, and composed children that follow the parent's variant.
- `component-sets.ts` · how a contract's output divides into sets and what each is called — a standalone
  mirror of the contract's own rules.
- `documentation-page.ts` · the documentation page plan (Header, Title, Copy me, Variants slice, master set),
  built from the artifact's `documentationTheme` + `documentationPage` and each contract's description and
  examples — a standalone mirror of the plugin's page plan, so both flows render the same page.
- `viewport.ts` · the viewport stand-in frame and the popup component of a window-placed component
  (dialog, alert-dialog, drawer, toast) — a standalone mirror of the plugin's frame and popup plan.

Only the **emitter** (the skill, via `use_figma`) is impure. `@focus/skill-figma-fidelity-check` adds
the checks that keep it honest.

## Independent capabilities (preflight-checked, never bundled — Decision 11)

1. **Figma MCP and skills** — from the official Figma plugin (MCP server plus `figma-use`,
   `figma-generate-library`). The skill probes for the MCP and stops with remediation if absent.
2. **Components** — needs `@workspace/ui` present (shadcn's monorepo-internal scope; installed by the
   scaffold, never renamed). The skill reads `.agents/figma.config.json → uiPackage` (default
   `@workspace/ui`). If components are absent, **self-heal** with `shadcn add @focus/ui-<name>` — they
   install into `@workspace/ui` directly (no rename step). Fails gracefully if the `@focus` registry
   link is severed.
3. **Variables** — bind-by-name against the Tokens Studio → Figma Variables export. Missing → raw
   values + a "run the plugin, re-run to rebind" prompt (the manifest makes a re-run an update, not a dup).

## Pairs with

- `@focus/figma-connect` — additive Code Connect templates, generated from the contract and this skill's manifest (separate opt-in).
- `@focus/skill-figma-fidelity-check` — scorecard + Definition-of-Done self-check + token-coverage gate.
