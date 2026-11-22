# @workspace/contracts

The contract compiler. It reads the `*.figma.contract.ts` file that sits next to each component,
validates it against the contract schema, pairs it with the component's source and stylesheet, and
writes the file the Figma plugin and the generation skills read, and a flat component catalogue for
agents:

```text
.agents/figma-generation-contract.json
.agents/component-catalogue.json
```

It is plain TypeScript source that Bun runs directly. There is no build step, and the whole package
is yours to read and edit. To rename `@workspace` to your own scope, change `name` in
`packages/contracts/package.json`, the import in `figma-contract-shape.d.ts` beside your
components, and the `--filter` in the root scripts below.

## Prerequisites

| Needed | Why |
|---|---|
| [Bun](https://bun.sh) | Runs the compiler source. Without it the commands exit with code 3. |
| A workspace root whose `package.json` declares a `packages/*` workspace | The package installs at `packages/contracts`, and the compiler finds the project root by walking up to that `package.json`. |
| `bun install` at the workspace root | Installs `zod`, `commander`, `typescript`, `postcss`, `postcss-selector-parser` and `@inquirer/prompts`, the runtime dependencies. `typescript` reads the union types that drive variant axes; it builds a type checker only for a type the component's own source does not spell out. `postcss` and `postcss-selector-parser` read the stylesheets. `@inquirer/prompts` is loaded only when a question is asked. |
| `components.json` with `aliases.ui` (or `componentsDir` in `contracts.config.ts`) | Tells the compiler where your components live. |
| Raw DTCG token sets in `packages/tokens/dtcg` (or `tokensDir` in `contracts.config.ts`) | Sizes such as `calc(var(--a) - var(--b) * 2)` need the tokens' numeric values, and CSS variable names need the token source's spelling. Without the folder the commands exit with code 3. Pull it from your Tokens Studio project with `bun --cwd packages/tokens run tokens:pull`, or add the default theme's raw token item (`tokens-default-theme-dtcg`) from the same registry. Re-run `compile` after a token change. |

Installing the package is optional for a component. A component that ships a contract works without
it: the contract file is plain data and imports only `figma-contract.ts`, which installs beside it.

## Install

```bash
bunx shadcn@latest add @focus/contracts-package
bun install
```

Then add scripts to the root `package.json` so the commands run from anywhere:

```json
{
  "scripts": {
    "figma:contract": "bun run --filter=@workspace/contracts figma:contract",
    "figma:contract:check": "bun run --filter=@workspace/contracts figma:contract:check",
    "contracts": "bun run --filter=@workspace/contracts contracts"
  }
}
```

The package also has one script per command (`contracts:validate`, `contracts:list`,
`contracts:explain`, `contracts:new`) for use from inside `packages/contracts`.

## Commands

```bash
bun run contracts compile          # compile every contract into the artifact and the component catalogue
bun run contracts check            # fail when the committed artifact or catalogue is stale
bun run contracts validate button  # check one contract (and any it composes) without writing
bun run contracts list             # list the contracts with their axes, examples and hash
bun run contracts explain button   # describe a contract next to what the component source declares
bun run contracts new toggle-group # write a starter contract from the component's code
```

Every contract has a hash: a fingerprint of the normalized contract that `compile --json`, `check --json`
and `list` report. It changes whenever the contract changes and is never written into the artifact.

`bun run figma:contract` and `bun run figma:contract:check` are shorthand for `compile` and `check`.
Run `bun run contracts -- --help` for the flags and an example of each command.

Run `compile` after changing component source, a component stylesheet, a `*.figma.contract.ts`, or
`contracts.config.ts`, and commit the artifact and the catalogue. `new <slug>` reads the component's `data-ui` parts
and variant axes and writes `<slug>.figma.contract.ts` beside it with one example per axis value, so
you add only what the code cannot say. It refuses to overwrite an existing contract unless you pass
`--force`.

## The component catalogue

`.agents/component-catalogue.json` is a flat summary of every compiled contract: each component's axes
with their values and defaults, its slots and what fills them, its part tree, and which components
compose which. An agent reads it to learn which components exist and what can go in each slot. It is
generated in the same run as the artifact and never edited by hand; `check` fails when it is stale.

Advice that the contracts cannot state (when to use a component, when not to, what it pairs with,
whether it is deprecated and what replaces it) goes in an optional file you write,
`.agents/component-guidance.json`, keyed by component slug. The compiler merges it into the catalogue
and refuses an entry or a link that names a component with no contract.

```json
{
  "version": 1,
  "components": {
    "tooltip": {
      "when": "Short, non-essential hints.",
      "avoidWhen": "The content is interactive.",
      "alternatives": ["popover"]
    }
  }
}
```

The fields of both files are listed in the generated catalogue reference when the documentation site
is installed with the contract references.

| Exit code | Meaning |
|---|---|
| 0 | Success. |
| 1 | A contract or an asset was refused, or the committed artifact is stale. |
| 2 | Usage error: an unknown command, flag or slug. |
| 3 | A prerequisite is missing. The message names the remedy. |

Every command accepts `--root <dir>` to name the workspace root instead of finding it.

## What is in the package

| Path | What it is |
|---|---|
| `src/generation-contract/authored-schema.ts` | The contract schema, written in Zod. Edit it to change what a contract may say. |
| `figma-contract.schema.json` | The JSON Schema generated from it, for editors and agents. |
| `src/project-compiler/commands.ts` | The command definitions: names, arguments, flags, exit codes and examples. `--help` is built from it. |
| `src/project-compiler/handlers.ts` | What each command does. It knows nothing about the command-line parser. |
| `src/project-compiler/program.ts` | The only file that uses `commander`. |
| `src/` (the rest) | The compiler modules: the contract engine, the CSS and source readers, and the entry point. |
| `contracts.config.ts` | Your configuration: the documentation page's token roles, its header, and an optional `componentsDir`. |
| `figma-layout.config.ts` | Per-component geometry that CSS cannot state. Optional: delete it and the compiler uses none. |
| `contracts.manifest.json` | The base schema version this copy started from and a hash of its JSON Schema. |
| `bin/contracts.mjs` | A Node launcher that starts the compiler with Bun and reports a missing Bun as exit code 3. |

The package also installs `figma-contract-shape.d.ts` beside the components. It types
`defineFigmaContract` with the schema, so type checking rejects an unknown key or a wrong field type
in any contract.

## Where components are found

The compiler looks for a component directory in this order:

1. `componentsDir` in `contracts.config.ts`, relative to the workspace root.
2. `aliases.ui` in the root `components.json`, then in each `packages/*/components.json`. A workspace
   package alias such as `@workspace/ui/components` is resolved through that package's `exports`.
3. `packages/ui/src/components`.

Each component folder is `<slug>/<slug>.tsx`, `<slug>/<slug>.css` and `<slug>/<slug>.figma.contract.ts`.

## Content slots

A region that accepts arbitrary children is a slot, not a set of docs-only nodes. Declare it with two
optional slot fields: `defaultContent: "anatomy"` makes the frame part that renders the slot the slot
itself, holding the anatomy subtree beneath it as default content (the documented example), and
`stretch: true` makes that frame fill its parent's cross axis, as the CSS region does. The part must be
a frame with children, and `defaultContent` cannot be combined with `composedChild`. Keep `synthetic`
nodes for layout wrappers that have no content role.

## Changing the schema

Edit `src/generation-contract/authored-schema.ts`. `figma-contract.schema.json` is a snapshot of the
base schema and does not follow your edits. The manifest records the base version and hash the
package shipped with, so a copy you have changed can be told apart from the base: compare
`currentSchemaHash()` in `src/project-compiler/manifest.ts` with `schemaHash` in
`contracts.manifest.json`.

## Unsized parts

`compile`, `check` and `validate` fail, naming the component, the part and the property, when a part's
width or height is written in the stylesheet but cannot be resolved to a number, a token or a fill.
Such a part would otherwise be drawn at Figma's default 100 x 100. Fix the token source, or declare the
size in `figma-layout.config.ts`.
