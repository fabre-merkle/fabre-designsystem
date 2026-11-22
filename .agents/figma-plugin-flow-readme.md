# @focus/figma-plugin-flow

Guidance for the Figma plugin flow. The plugin reads one input, the V2 artifact:

```text
.agents/figma-generation-contract.json
```

The contract compiler builds it. This item depends on the `contracts-package` item, which installs
the compiler as `packages/contracts` (editable TypeScript that Bun runs directly). Installing this
item therefore also installs the compiler.

> **Scaffold-provisioned flow:** selecting this item through the project scaffolder also writes
> `packages/contracts/contracts.config.ts`, the root `figma:contract` and `figma:contract:check`
> scripts, and the committed artifact. A direct `shadcn add` installs the compiler and this
> guidance; add the root scripts yourself (the compiler's own README lists them), make sure the
> workspace root declares `packages/*`, run `bun install`, then compile.

After changing component source, CSS, a co-located `*.figma.contract.ts`, or
`packages/contracts/contracts.config.ts`, run:

```bash
bun run figma:contract
bun run figma:contract:check
```

Commit the artifact. The plugin discovers it automatically at the conventional
path; if a repository uses a different layout, enter that repository-relative
path in the plugin. The custom path is remembered for that repository and branch.
