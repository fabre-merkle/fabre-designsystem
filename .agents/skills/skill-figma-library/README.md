# @focus/skill-figma-library

An agent skill that runs the **whole** code→Figma flow for your project end to end: bootstrap the
Figma variables, generate the components, generate the Code Connect templates, and run the fidelity
check, in one orchestrated pass.

Installs to `.claude/skills/skill-figma-library/`, read natively by Claude, Copilot and Cursor.

## Requires

Pulled in automatically as `registryDependencies` (the two primitive skills it orchestrates):

- `@focus/skill-figma-generate`: variables (Pattern A) and component generation
- `@focus/skill-figma-fidelity-check`: scorecard, Definition-of-Done and token-coverage gate

Preflight-checked, never bundled: the Figma MCP (the official Figma plugin or the remote Figma MCP)
and, only if you want Code Connect, `@focus/figma-connect` (which installs the template generator)
and Figma's requirements for publishing: a Dev or Full seat on a Professional, Organization or
Enterprise plan, the file in a team project, published as a library. Generation, variables and
fidelity work without them.

## What it does

A **thin orchestrator**: it sequences the primitives, runs the optional Code Connect step, and
reports one consolidated result. It leans on the official Figma skills (`figma-use`,
`figma-generate-library`, `figma-create-new-file`) for how to drive Figma, and on the official
`figma-code-connect` skill for any mapping the contract does not cover. It runs in your project's
coding agent, not at scaffold time.
Reads `packages/ui/src/components/*`, the same component set that powers Storybook.
