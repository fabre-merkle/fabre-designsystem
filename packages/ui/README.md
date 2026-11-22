# `@workspace/ui`

The **shared design-system package** for a scaffolded project. It is the single, canonical
home for design-system components in the monorepo: components live here **once** and every app
consumes them via a `workspace:*` dependency + Next.js `transpilePackages` — no per-app copies.

> **`@workspace/ui` is *your* package, not the component registry.** Components are supplied through
> the **`@focus` registry** (`focus.merkle.design`); they get **installed into** this package. The
> package itself is yours to rename and evolve. Rename the `@workspace` scope to your own at scaffold
> time (e.g. `@acme/ui`) — see "Rename rule" below.

## Installing components — `shadcn add @focus/ui-<name>`

This package ships a `components.json` that does two things:

1. **Declares the `@focus` registry namespace** so the CLI can resolve the registry's components:

   ```jsonc
   "registries": { "@focus": "https://focus.merkle.design/r/{name}.json" }
   ```

2. **Points the install target at this package** via `aliases.ui` → `@workspace/ui/components`. The
   `@ui/<name>/<file>` target placeholder the registry items use resolves against that alias, so
   each component lands co-located under `src/components/<name>/` (the `.tsx`, its sibling `.css`,
   and an `index.ts` barrel).

From this package directory:

```bash
shadcn add @focus/ui-button        # → src/components/button/{button.tsx,button.css,index.ts}
shadcn add @focus/ui-dialog @focus/ui-select
```

(Component registry items are kind-prefixed `ui-<name>` to distinguish them from other `@focus`
registry kinds — `skill-figma-*`, `mcp-*`, `tokens-*`, `arch-*`, `docs-*`. The installed files still
land under `src/components/<name>/` — only the registry item id carries the `ui-` prefix.)

Imported with no `package.json` edit, thanks to the wildcard export
(`"./components/*": "./src/components/*/index.ts"`):

```ts
import { Button } from "@workspace/ui/components/button";
```

The global baseline (layer order + resets) is `@workspace/ui/styles` (`src/styles/globals.css`).

## Pair with tokens for values

Components reference design tokens (`var(--color-*)`, `var(--shadow-*)`, …). The **values** come
from the token package — install **`@focus/tokens-default-theme`** (resolved `css/*.css`, incl.
`brand/fabre-designsystem.css`) and import the cascade from your app's `globals.css`. Without it, components
render unstyled (CSS custom-property fallbacks only).

## Package scope

`@workspace/ui` is **shadcn's standard monorepo-internal scope** — it is *not* a placeholder to
rename. It is kept deliberately: the scaffold's rename step namespaces only the local
`@focus/{tokens,docs}` packages to `@<prefix>/`, and leaves `@workspace/ui` as-is (it carries no
`@focus` reference). This matches where shadcn installs shared components in a monorepo, so the CLI
routes `@focus/ui-*` adds into this package out of the box.

If a project insists on its own scope, rename `@workspace` → `@<your-scope>` manually in this
`package.json` + `components.json` aliases + each consuming app's dependency / `transpilePackages` /
`components.json`. This is **not** automated and not the default.

## Per-app wiring contract

Each app that consumes the design system needs three things (the scaffolder wires these per app):

1. **Dependency:** `"@workspace/ui": "workspace:*"` in the app's `package.json`.
2. **Transpile:** `transpilePackages: ["@workspace/ui"]` in the app's `next.config.mjs` — this
   package ships raw TS/CSS source (no build step), so apps transpile it.
3. **App `components.json`:** `aliases.ui` → `@workspace/ui/components`, carrying the same
   `registries` map. **`style` / `iconLibrary` / `baseColor` must match this package's
   `components.json`** — a shadcn monorepo requirement so the CLI routes shared components here
   (and app-specific ones to the app) consistently.

With that in place, `shadcn add @focus/<name>` run **from an app** lands the component in this
shared package and installs any app-specific files into the app.

## Notes

- **Not Tailwind-utility based.** These components are Base UI primitives + layered CSS keyed off
  design tokens. The `tailwind` block in `components.json` is present only to satisfy the shadcn
  schema (it points the CLI at the global stylesheet); no Tailwind utilities are required.
- **No build step.** TS + CSS source is shipped raw and transpiled by each consuming app.
