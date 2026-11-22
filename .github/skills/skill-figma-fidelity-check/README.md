# `@focus/skill-figma-fidelity-check`

Assert **code↔Figma parity**: a structured fidelity scorecard, the generation **Definition-of-Done**
self-check, and a **token-coverage gate** that catches stale/missing tokens before they ship. Forked
from the reversed `design-to-code-check` dimensions. Runs ad-hoc and in CI.
See `SKILL.md`.

## Install

```bash
shadcn add @focus/skill-figma-fidelity-check
```

Lands at `.claude/skills/skill-figma-fidelity-check/` (`SKILL.md` + `tests/token-coverage.mjs` +
`tests/fixtures/figma-variables.json`) — read natively by Claude Code, GitHub Copilot and Cursor (no
linking step).

## Token-coverage gate (runnable)

```bash
node tests/token-coverage.mjs \
  --components <packages/ui/src/components> \
  --variables  tests/fixtures/figma-variables.json   # or your project's current Studio → Figma export
```

For every `var(--token)` in the component CSS it asserts a Figma variable resolves by separator-stripped
name match (`--color-primary-on-brand` ↔ `color/primary/onBrand`). Shadows → effect-styles (not drift);
computed/runtime + animation vars → N/A. **Exits non-zero on drift.** Wire it into CI to keep the
component library token-clean (focus runs exactly this gate in `.github/workflows/ci.yml`).

> `figma-variables.json` is the **Tokens Studio → Figma Variables** export (names match because CSS
> tokens and Figma variables derive from the same DTCG source). Refresh it on token-set changes. The
> bundled fixture is a snapshot of the template token project — 557 variables.

## Roadmap (credit reduction)

The deterministic core (Kumo `drift-detection.test.ts`) is the path to a registry-driven generator that
moves the validated rules into **code**, cutting per-run AI cost.
