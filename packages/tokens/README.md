# `@fabre-designsystem/tokens`

The token **package shell** for a scaffolded project. Exposes the resolved
CSS custom-property cascade to the rest of the workspace and wires the Tokens
Studio CLI for pulling updates. Ships no token *values* itself — pair it with:

- **`@focus/tokens-default-theme`** — the resolved `css/*.css` values (incl.
  `brand/fabre-designsystem.css`). Lands in `packages/tokens/css/`.
- **`@focus/tokens-default-theme-dtcg`** *(optional)* — the raw DTCG JSON schema, if
  you want to integrate tokens as JSON directly instead of via Tokens Studio.

## Exports

```jsonc
"exports": { "./css/*": "./css/*" }
```

Consumers import the cascade by file, e.g.:

```css
@import "@fabre-designsystem/tokens/css/foundation/default.css";
@import "@fabre-designsystem/tokens/css/brand/fabre-designsystem.css";
@import "@fabre-designsystem/tokens/css/theme/light.css";
/* …theme/dark, semantic-web, component, web/*, semantic-fumadocs */
```

Each file scopes its vars under `[data-foundation]` / `[data-brand="fabre-designsystem"]` /
`[data-semantic-web]` / `[data-web]` / `[data-semantic-fumadocs]` attributes set on
`<html>`. Semantic colors are named by role (`--color-surface-level-1`,
`--color-on-surface`, `--color-intent-error`, `--color-primary-brand`) with `-hover` /
`-container` / `-subtle` variants — there is no `-default` suffix.

## Re-pulling tokens

If you installed `@focus/tokens-studio`, see **`TOKENS-STUDIO.md`** for the full re-pull
setup — connecting your own Tokens Studio project, automatic safe CLI bootstrap,
and running configured exports via `bun run tokens:studio:exports`. The
`tokens-studio` item supplies CLI v2 `raw` and split `css` output recipes. `tokens:pull`
refreshes DTCG; `tokens:studio:exports` runs the authored CSS preset and consumer transforms.

## Brand naming

The `brand/*.css` file is named after the Studio brand dimension. The default theme
exports `brand/fabre-designsystem.css` (`[data-brand="fabre-designsystem"]`). When you generate CSS for a new
brand, name the Studio brand dimension `default` (or rename the exported `brand/<x>.css`
→ `brand/fabre-designsystem.css`) so the scaffold's imports resolve.
