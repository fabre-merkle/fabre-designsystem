---
name: skill-figma-library
summary: Build and check the Figma library from code.
version: 2026.11.07
description: >
  Generate or update your project's WHOLE Figma component library from code, end to end:
  bootstrap the Figma variables, generate the components, generate the Code Connect templates,
  and run the fidelity check, in one orchestrated pass. Use when the user wants to "build/update
  the Figma library", "sync code to Figma", or run the full code→Figma flow rather than a single
  step. A thin orchestrator over skill-figma-generate and skill-figma-fidelity-check.
  Renamed into scaffolded projects as @<dsname>/skill-figma-library.
---

# skill-figma-library

> **MANDATORY: load these official Figma skills before any Figma writes** (they come with the
> official Figma plugin):
> 1. `figma-use`: the Plugin API bridge that governs every `use_figma` call.
> 2. `figma-generate-library`: discovery (`search_design_system`), the build protocol, checkpoints.
> 3. `figma-create-new-file`: plan resolution (`whoami`, planKey) for creating a file.
>
> They own how to drive Figma. This skill sequences the project-specific steps around them and
> does not restate them.

Run the whole code→Figma flow for the project. This skill is a **thin orchestrator**: it sequences
the primitives, checks everything once up front, and reports one result.

- **`skill-figma-generate`**: variables (Pattern A) and component generation from the compiled
  contract.
- **`skill-figma-fidelity-check`**: fidelity scorecard, generation Definition-of-Done, token
  coverage gate.
- **Code Connect templates**: generated from the contract and the manifest by the contract
  package's `figma:connect` command (below).

It runs in your project's coding agent, where the Figma MCP and your Figma auth live, never at
scaffold time.

## Preflight (once, up front, before any Figma write)

1. **Generation contract readable?** Load `.agents/figma-generation-contract.json` with
   `skill-figma-generate`'s reader. If it throws (absent, malformed, or a version the skill does not
   read), **STOP** and give the user the error's remediation verbatim. Never continue on inferred
   component semantics.
2. **Figma MCP available?** Probe for the Figma MCP tools. If absent, STOP: install the official
   Figma plugin (or add the remote Figma MCP) for your agent. Never install it from this skill.
3. **Components and tokens present?** `@<dsname>/ui` under `packages/ui/src/components/*` and the
   project DTCG under `packages/tokens/dtcg/` (the source for the variable bootstrap).
4. **Target file.** `.agents/figma.config.json → figma.projectId` / `figma.planKey`; when blank, follow
   `figma-create-new-file`. Never hardcode a planKey.

## Flow

1. **Plan.** List the components to (re)generate and the variable collections to bootstrap, and
   confirm the target file with the user before the first Figma write.
2. **Variables (Pattern A).** Invoke `skill-figma-generate --bootstrap-variables`. This project is
   the single variable writer (upsert by name, never purge); do not also push from the Tokens Studio
   plugin to the same file.
3. **Generate components.** Invoke `skill-figma-generate` for each component. It writes each
   component's Figma nodes to `.agents/figma.json`.
4. **Code Connect (optional).** Needs `@<dsname>/figma-connect` installed and Figma's requirements
   met (a Dev or Full seat on a Professional, Organization or Enterprise plan; the file in a team
   project, published as a library). Otherwise skip, say so in the report, and finish. When it
   runs:
   - `bun run --filter=@workspace/contracts figma:connect` writes a `.figma.ts` template next to each
     generated component, in Figma's parserless template format, from the contract (axes, slots, the
     code props they stand for), the component's own props, and the manifest's node ids.
   - **A window-placed component** (dialog, alert dialog, drawer, toast) generates a bare popup
     component, named `<Name> Popup`, as well as its viewport frames. Code Connect can map only a
     component or a component set, never a frame, so the manifest's `nodeId` must be the popup node.
     Check it before generating.
   - **Part contracts** (`field-label`, `field-description`) map as members of their source component
     (`Field.Label`); no per-part authoring.
   - **Anything else** (a component with no contract, a hand-made mapping) is authored with the
     official `figma-code-connect` skill. Keep those files free of the generated header: the check
     only manages generated ones.
   - Commit the templates. `figma:connect:check` (CI, no token) fails on a missing, hand-edited or
     obsolete one. Publishing is `bun run figma:connect:publish` in CI on `main`, or the official skill's MCP
     route; either needs a token with the Code Connect (write) and File content (read) scopes.
5. **Fidelity check.** Invoke `skill-figma-fidelity-check`. Treat a Definition-of-Done failure (a
   frame standing in for a component, a missing page or header, drift) as a defect to fix, not a
   warning.
6. **Report.** One summary: variables created or updated, components generated, Code Connect
   templates written or skipped (and why), and the fidelity scorecard.

## Contracts

Reading, validating and changing contracts is described in `skill-figma-generate` (section
"Contracts: schema, commands, and how they land"). Read it before writing or judging a contract.

## Rules

- **Delegate, don't duplicate.** A Plugin API detail, a mapping rule or a bootstrap step belongs to
  the skill that owns it. This skill owns sequencing, gating and the report.
- **Idempotent.** A re-run upserts (variables by name, components by manifest entry, templates by
  regeneration); it must not duplicate. Preserve that: never purge and recreate.
- **Generation works without Code Connect.** Never make the run depend on it.

## Out of scope

- **Not a scaffold step.** The scaffold is headless; the library is generated here, in the project.
- **Setting up the Figma MCP or Storybook.** Separate opt-in items, preflight-checked here.
