# `@focus/tokens-studio` — Tokens Studio integration

The **opt-in** Tokens Studio integration for a scaffolded `@fabre-designsystem/tokens` package. Layered on
top of the package shell (`@focus/tokens-package`) + the resolved CSS (`@focus/tokens-default-theme`),
it adds everything needed to push and re-pull tokens from your own Tokens Studio project:

- `.studio.json` — CLI v2 source plus `raw` (DTCG → `dtcg/`) and split `css`
  (CSS → `css/`) output recipes (fill `PROJECT_UUID` or use the initial-push skill).
- `scripts/studio-push-prepare.ts` — flattens DTCG → chunked push payloads + the split `css`
  export config (and a dedicated unlayered `css-storefront` config when Storefront is installed).
- `scripts/studio-exports-setup.ts` — creates and runs those CLI export presets, builds the
  Storefront bundle from the dedicated export, copies its unlayered semantic bridge, and applies
  the Fumadocs transform when installed.
- `scripts/emit-fumadocs-theme.mjs` — wraps the exported `semantic-fumadocs` set in `@theme { … }`
  (Tailwind v4 needs `@theme`, not a plain `@layer{:root}`, to generate `bg-fd-*`/`text-fd-*`
  utilities). Runs only when `apps/docs` + the `semantic-fumadocs` DTCG set are present.
- `scripts/build-storefront-bundle.ts` — assembles the Storefront dependency closure from the
  unlayered split export. Its `semantic-storefront/default.css` also replaces the layered file
  from the general export when the bridge (`@focus/tokens-storefront-bridge`) is installed.
- `.env.example` — the `TOKENS_STUDIO_TOKEN` service token it reads for non-interactive use.
- `package.json` — adds the `@tokens-studio/studio-cli` devDep + automatic safe CLI bootstrap /
  `tokens:studio:prepare` / `tokens:studio:exports` scripts to the package. Day-to-day
  pulls and exports use the Studio CLI directly (see commands below).

> **Why a dedicated Storefront preset?** The regular `css` preset uses split layout to isolate
> each set, but its cascade layers cannot supply the bare Storefront `:root` bridge. The optional
> `css-storefront` preset is also split, with layers disabled; it stages the source for the
> Storefront bundle and bridge without overwriting unrelated CSS. It does not attempt a
> token-set filter or a single-file export of the whole project (focus#521).

> **You only need this if you want to keep editing tokens in Tokens Studio.** The resolved
> `css/*.css` shipped by `@focus/tokens-default-theme` is the **default and the fallback** — the app
> builds and renders with no Tokens Studio account, token, or network. Projects that don't use Tokens
> Studio simply omit this item, and their `@fabre-designsystem/tokens` package stays free of all Studio config.

## Initial project push (agent-driven)

The scaffold completion screen and `README.md` include a prompt to invoke the
**`skill-tokens-studio`** skill for the initial push. The skill:

1. Runs `bun run tokens:studio:prepare` to prepare push payloads.
2. Creates (or selects) a Tokens Studio project via the MCP.
3. Pushes all token chunks via `tokens_batch_create`.
4. Creates theme groups + options from `$themes.json`.
5. Checks `.studio.json` against the selected project and ref, filling `PROJECT_UUID`
   only if necessary. A mismatch stops setup without overwriting existing recipes.
6. Runs `bun run tokens:studio:exports` to create and run the `css` preset and optional
   `css-storefront` preset, then deliver the Fumadocs map and Storefront bundle/bridge.

See `~/.agents/skills/skill-tokens-studio/SKILL.md` for the complete runbook.

## Re-pull CSS (non-interactive — agents + CI)

Set `TOKENS_STUDIO_TOKEN` (a project-scoped service token from Settings → Service tokens) in
`.env` for non-interactive use. Without it, the CLI uses the keychain session from `studio auth login`.

```bash
# Refresh configured CSS exports and their Fumadocs/Storefront delivery files.
bun run tokens:studio:exports
```

## Direct DTCG pull

```bash
# Pull raw DTCG token sets (force overwrites unchanged files)
bun run tokens:pull

# Watch for remote changes and re-pull automatically
bun run tokens:setup && studio watch
```

## Automatic CLI bootstrap (local dev only)

`@tokens-studio/studio-cli` ships JS-only; its platform binary is downloaded by a `postinstall`
script that Bun gates. Every Studio-dependent `tokens:*` command first checks for the local binary
and runs the safe installer only when it is missing. No manual setup is normally required.

```bash
# Optional: preinstall the binary before running a Studio command.
bun run tokens:setup
```

`tokens:setup` calls the installer directly — bypassing the Bun gate — and is idempotent. Verify
with `studio --version`.

> **Do not add `@tokens-studio/studio-cli` to `trustedDependencies`.** Its postinstall renames files
> across device boundaries on Vercel, causing an `EXDEV: cross-device link` error that breaks every
> production build. The binary is a local dev tool; the build pipeline only consumes `css/*.css`.
