# tokens-sync

A GitHub Actions workflow that pulls the resolved token CSS from your Tokens Studio project and opens
a pull request with the refreshed files. A clean **publish → PR** loop.

Installs `.github/workflows/tokens-sync.yml`. Pairs with the tokens package (`packages/tokens`), where
every configured export writes under `packages/tokens/css/`.

## What it does

1. Checks out the repo and sets up Node.
2. Uses npm to install `@tokens-studio/studio-cli@0.3.0` under
   `$RUNNER_TEMP/tokens-studio-cli` (including its native-binary postinstall), then invokes
   that installation's absolute executable path, never a global or workspace CLI.
3. Checks the committed CLI v2 `.studio.json` against `TOKENS_STUDIO_PROJECT_ID` without replacing it.
4. **Discovers every export preset the project has configured** from the committed
   `.studio-push/exports/*.json` (written once by the Tokens Studio integration's
   `tokens:studio:prepare` at initial push time). If that directory doesn't exist
   (tokens-studio was never added, or no push has run yet), it falls back to the
   single `css` preset.
5. Runs the regular presets via **OIDC** into `packages/tokens/css/`. If configured,
   `css-storefront` runs into a separate temporary directory: its unlayered split output
   supplies both `css/storefront/default.css` (the dependency-closure bundle) and
   `css/semantic-storefront/default.css` (the runtime bridge).
6. Applies the Fumadocs `@theme` transform when its script is installed. Without it,
   recurring sync would overwrite `css/semantic-fumadocs/theme.css` with an unwrapped
   file and break the docs app's import.
7. Opens a PR (`peter-evans/create-pull-request`) with the refreshed token CSS.

This keeps recurring sync consistent with the initial export: the split `css` preset
supplies general CSS and Fumadocs, while the optional unlayered `css-storefront`
supplies the Storefront bundle and semantic bridge. A future new preset is picked up
from `.studio-push/exports/` without changing the workflow.

## Triggers

- **`repository_dispatch` (`tokens-published`)** — the "on publish" path: fires when Tokens Studio
  publishes a new release.
- **`schedule`** — a weekly safety-net pull, so tokens stay in sync even before the publish→dispatch
  wiring is in place.
- **`workflow_dispatch`** — manual run from the Actions tab.

## Ships ready-but-inert — one-time setup

The workflow is installed and valid, but it does nothing useful until you connect your Tokens Studio
project once:

1. **OIDC integration** — in Tokens Studio, configure a GitHub *inbound OIDC* integration for this
   repo so the CLI can authenticate with no long-lived token. The workflow already grants
   `id-token: write`.
2. **`TOKENS_STUDIO_PROJECT_ID` secret** — add your Studio project UUID as a repository secret
   (Settings → Secrets and variables → Actions).
3. **Publish → dispatch link** — wire Tokens Studio's "release published" event to this repo's
   `repository_dispatch` with `event_type: tokens-published`, either through Tokens Studio's GitHub
   integration or a small webhook→dispatch bridge.

Until step 3 is wired, the **`schedule`** trigger still guarantees a weekly sync, and you can always
run it manually via `workflow_dispatch`.
