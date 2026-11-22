# Code Connect

Code Connect configuration for the templates your project generates from its contracts. Ships the
config and a CI workflow, and documents the small set of manual wiring a registry item cannot patch
(`package.json`, `tsconfig`).

## Project setup

The selected integration is already installed. For another project, consult this design system's
registry documentation and use its published namespace and discovered item name. If no integration
is published, ask the maintainer to provision it rather than substituting an upstream item.

The integration provides:
- `figma.config.json` → project root (`"label": "React"`, `include: ["packages/ui/**/*.figma.ts"]`).
- `.github/workflows/figma-code-connect.yml` → a template check on every pull request (no token) and
  a publish job on `main`, as Figma's CI guide describes.

It depends on the contract compiler package, which holds the template generator.

## What it is for

Code Connect templates are the parserless `.figma.ts` files Figma's official `figma-code-connect`
skill writes: a `figma.code` snippet per component, with `getEnum`, `getSlot`, `getString`, `getBoolean` and
`getInstanceSwap` reading the component's Figma properties. This project generates them from what it already
declares:

- the compiled contract (`.agents/figma-generation-contract.json`): the variant axes and slots the
  Figma library was built from, and which code props they stand for;
- the component's own props, read from its TypeScript type;
- the generation manifest (`.agents/figma.json`): the Figma node of each component.

```bash
bun run figma:connect           # write the templates
bun run figma:connect:check     # fail on any difference, no token
bun run figma:connect:publish   # publish with the installed CLI (needs FIGMA_ACCESS_TOKEN)
```

Each template sits next to its component (`button/button.figma.ts`) and starts with a header that
marks it as generated. Commit the templates and `.agents/figma.json` together. The check fails when a template is missing, was edited by hand,
or is left over after its component left the contract; the write command removes the left-over
ones, and never touches a template without that header. Anything the contract does not say stays
out of the snippet and is listed at the top of the template as "Not mapped".

A contract that splits into one set per value of an axis has one template per set
(`button/button.primary.figma.ts`), each mapping the same component with the split value as a fixed
prop. Record each set's node in `.agents/figma.json` under `sets`, keyed by the value. A Building
Block (a hidden set for a sub-element with its own states) has a template too
(`select/select.select-item.figma.ts`), keyed by its part under `buildingBlocks`. A block that
splits has one template per set (`tabs/tabs.tabs-tab.line-horizontal-md.figma.ts`); record each
set's node under `sets` within its part, keyed by the value.

Write other mappings (a component the contract does not cover) with the official
`figma-code-connect` skill from the Figma plugin, and keep them in files without the generated
header.

## Manual wiring (apply after install)

1. **Dependency:** `bun add -D @figma/code-connect` at the repo root. It provides the `figma connect`
   command and the editor types. Publish through a script that runs the installed binary, never
   `bunx figma`, which can download an unrelated npm package named `figma`.
   Merge these entries into the root `package.json` scripts (keep existing ones; replace
   `@workspace` if you renamed the contracts package):

   ```json
   {
     "figma:connect": "bun run --filter=@workspace/contracts figma:connect",
     "figma:connect:check": "bun run --filter=@workspace/contracts figma:connect:check",
     "figma:connect:publish": "figma connect publish -c figma.config.json --exit-on-unreadable-files"
   }
   ```
2. **tsconfig types:** add `"@figma/code-connect/figma-types"` to `compilerOptions.types`.
3. **Formatter:** exclude `**/*.figma.ts` from your formatter and linter. The check compares the
   templates byte for byte with the generator's output, so reformatting one makes it fail.
4. **Publish token:** create a Figma token with the Code Connect (write) and File content (read)
   scopes and add it as the CI secret `FIGMA_ACCESS_TOKEN` (`gh secret set FIGMA_ACCESS_TOKEN`), or
   to local `.env.local` for a manual publish. Figma recommends a Plan Access Token for CI on
   Organization and Enterprise plans and a personal access token on Professional. Generation never
   needs a token; only publishing does.

Figma requires a Dev or Full seat on a Professional, Organization or Enterprise plan to publish.
The library must be published as a team library, and the components must live in a team project,
not in Drafts.

## End-to-end flow

For the full ordered path (tokens, Tokens Studio, Figma variables, generate, Code Connect) with the
single-writer rule, see `.agents/connect-to-figma.md`, shipped alongside this file.

## Notes

- Code Connect is additive and independent of generation: generation works without it.
- Renamed to `@<dsname>/figma-connect` in a scaffolded project.
