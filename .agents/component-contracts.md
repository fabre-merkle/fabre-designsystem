## Component contracts

Every visual component in `packages/ui` has a contract, `<name>.figma.contract.ts`, beside its
`.tsx` and `.css`. A contract describes what the component's source and styles cannot say, such as
design-only axes, anatomy and documented examples. The compiler in `packages/contracts` turns the
contracts into `.agents/figma-generation-contract.json`, which the Figma plugin and the generation
skills read, and into `.agents/component-catalogue.json`, a flat summary for agents: every
component with its axes and values, its slots and what fills them, its part tree and which components
compose which. Read the catalogue to learn what exists and what can go where; never edit it by hand.
This applies whether or not a Figma flow was selected.

**Where things live**

- Contracts: `packages/ui/src/components/<name>/<name>.figma.contract.ts`.
- Catalogue guidance: `.agents/component-guidance.json` (optional, authored) holds when to use a
  component, when not to, what it pairs with, deprecations and alternatives, keyed by component slug.
  The compiler merges it into the catalogue and refuses an entry that names a component with no
  contract.
- Schema, yours to read and change: `packages/contracts/figma-contract.schema.json` (JSON Schema),
  `packages/contracts/src/generation-contract/authored-schema.ts` (the Zod source) and
  `packages/contracts/src/generation-contract/diagnostics.ts` (every refusal code with its remedy).
  Read these first. A registered design-system MCP server is the second source, for the current base
  schema to compare against.

**Validate**

```bash
bun run figma:contract:check                               # fail when the artifact or catalogue is stale
bun run figma:contract                                     # recompile, then commit the artifact and catalogue
bun packages/contracts/bin/contracts.mjs validate <slug>   # check one contract without writing
bun packages/contracts/bin/contracts.mjs explain <slug> --json
bun packages/contracts/bin/contracts.mjs new <slug> --yes  # starter contract from the component's code
```

Agents pass every argument and flag explicitly and never wait on a prompt: use `--json` to read
diagnostics (code, path, message, remedy) as data and `--yes` to confirm. Exit codes: 0 ok, 1 refusal
or drift, 2 usage, 3 missing prerequisite.

**Review workflow**

A contract an agent writes or changes is proposed in a pull request, and a person reviews and merges
it. A passing `check` is evidence for the reviewer, not acceptance, so never push a contract to the
default branch or treat it as accepted before it is merged.
