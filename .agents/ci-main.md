# ci-main

A GitHub Actions workflow that runs the core quality gates for the monorepo on every pull request
(and on push to the default branch): **Biome lint/format check → TypeScript typecheck → Turbo build**.

Installs `.github/workflows/ci.yml`.

## What it does

1. Checks out the repo and sets up **Node 24 LTS** and **Bun** (pinned version).
2. Installs dependencies with `bun install --frozen-lockfile`.
3. **Lint & format** — `biome ci .` (no writes; fails on lint errors or unformatted files).
4. **Type check** — `bun run check-types` (Turbo fans out `tsc --noEmit` per workspace; Next apps run `next typegen` first).
5. **Build** — `bun run build` (Turbo builds every app/package, cached per task).

## Assumptions

- A **Bun + Turborepo** workspace (the standard scaffolded architecture).
- A root `check-types` script and a root `build` script wired through Turbo.
- Biome configured at the repo root (`biome.json`).

## Use

No secrets required. The action SHAs are pinned for supply-chain safety; bump them via Dependabot or
Renovate as you would any other pinned action.

## Enterprise GitHub organisations — hosted runners disabled

Some organisations (e.g. Dentsu, Merkle) disable GitHub-hosted runners by policy. When this is the
case every CI job targeting `ubuntu-latest` will fail immediately with:

> GitHub Actions hosted runners are disabled for this repository. For more information please
> contact your GitHub Enterprise Administrator.

**Fix: switch to a self-hosted runner.** Update `.github/workflows/ci.yml`:

```yaml
jobs:
  ci:
    runs-on: [self-hosted, linux]   # ← replace ubuntu-latest with your org's runner label
```

Your GitHub administrator can tell you the correct label (common values: `self-hosted`,
`[self-hosted, linux, x64]`, `[self-hosted, Linux]`).

**Temporary workaround if no runner is available yet:** disable automatic triggers until one is
provisioned by commenting out the `on:` block and adding `workflow_dispatch:` instead so the
workflow only runs when you trigger it manually.

```yaml
on:
  workflow_dispatch:    # manual trigger only — remove this and restore push/pull_request
                        # triggers once a self-hosted runner is registered
# on:
#   pull_request:
#     branches: [main]
#   push:
#     branches: [main]
```
