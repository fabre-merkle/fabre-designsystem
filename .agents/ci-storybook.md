# Storybook CI

A GitHub Actions workflow that runs the `@workspace/ui` Storybook **interaction (play) + a11y tests**
on every pull request that touches `packages/ui`.

Installs `.github/workflows/storybook.yml`. Requires the project's Storybook workshop —
it runs `bun run test-storybook` (the Vitest Storybook browser project) in `packages/ui`, installing
Playwright Chromium first.

No secrets needed. For visual-regression review, ask the project maintainer to enable Chromatic CI.
