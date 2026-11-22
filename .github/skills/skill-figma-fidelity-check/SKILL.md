---
name: skill-figma-fidelity-check
summary: Check generated Figma components against code.
version: 2026.11.05
description: >
  Assert code↔Figma parity for generated components: a structured fidelity scorecard, the generation
  Definition-of-Done self-check (against the V2 generation contract), and a token-coverage gate that catches stale/missing tokens. Forked
  from the design-to-code-check dimensional framework (reversed). Runs ad-hoc
  and in CI. Renamed to @<dsname>/skill-figma-fidelity-check.
---

# skill-figma-fidelity-check

The open-source equivalent of Console MCP's parity analysis — keeps Phase 1 on official-MCP-only.

## 1. Fidelity scorecard (per component)

Reversed [`design-to-code-check`](https://github.com/murphytrueman/design-system-ops/blob/main/skills/design-to-code-check/SKILL.md)
dimensions + binding/idempotency rows; emits that skill's structured discrepancy report (Type I–IV +
severity).

| Dimension | Target |
|---|---|
| Structural mapping (props → variant properties 1:1) | 100% of props represented |
| Variant/state coverage | ≥ 95% |
| Variable binding (correctly-named var vs raw) | ≥ 90% bound |
| Visual fidelity (rendered Figma vs rendered code) | within tolerance (Chromatic if present) |
| Auto-layout (direction/gap/padding/sizing) | matches |
| Theme (light + dark via modes) | both resolve |
| Idempotency (re-run = update, no dupes) | 100% |
| Cost/speed | recorded |

## 2. Generation Definition-of-Done self-check

Assert each generated component satisfies its entry in `.agents/figma-generation-contract.json`
(`skill-figma-generate`):
real `COMPONENT`/`COMPONENT_SET` (no frame standing in for a component or slot) · every contract part,
native slot and composed child present as declared · every variant cell present, sized per the contract's
geometry (a refused size is reported, never approximated) · window-placed components inside their viewport
frame · own page with the documentation chrome the artifact's `documentationTheme` names · one mode panel
per theme mode · manifest entry · Code Connect (if enabled).
**Fail if any frame is acting as a component or slot.**

## 3. Token-coverage gate (catches drift automatically)

> **Runnable harness:** `tests/token-coverage.mjs` + `tests/fixtures/figma-variables.json` (co-located,
> ship with this skill).
> `node token-coverage.mjs --components <packages/ui/src/components> --variables <figma-variables.json> [--only a,b]`.
> Exits non-zero on drift — wire into CI. Validated: against the original migration (`step-10a`) it
> flagged 8 drift tokens across the 5 fixtures; against the fixed branch (`step-10e/fix-renamed-token-refs`)
> it reports **0 drift across all 35 components**. Shadows are bucketed as effect-styles (not drift);
> computed/runtime + animation vars are N/A.


- Grep every component's CSS for `var(--…)` → the full set of design tokens in use.
- Generate (or assert generated) the **minimal component set that exercises every design token**.
- For each token, confirm a Figma variable resolves by separator-stripped name match.
- **Report stale/missing tokens** — every fixture in run #1 surfaced drift: `typography-button-text-case`,
  `color-error-on-container`, `typography-heading-md`→`headline`, `color-surface-base`, `shadow-high`,
  `typography-label-md-font-weight`. Exclude computed/runtime CSS vars (`active-tab-*`, `switch-block-size`,
  `anchor-width`, `transform-origin`, panel heights) — not design tokens, don't bind.
- Output: a drift report → fails CI / opens an issue listing stale tokens to fix in code (faithful-mirror:
  fix the token name in the component CSS, then re-gen).

## 4. Enforcement — the parity gate

Both Figma flows read one artifact, `.agents/figma-generation-contract.json`, and must emit structurally
equivalent nodes. The emitted-node parity gate enforces that: it runs the Figma plugin's
`generateComponents` and `skill-figma-generate`'s `renderComponentPlan` against one in-memory Figma and
compares the node trees node by node. It runs in the generator's own CI, not in your project.

- **Your project** runs sections 1–3 against the library it generated.
- **A Definition-of-Done failure on a skill-generated library** is a defect in the skill or the artifact.
  Report it with the component slug. Do not patch the Figma file by hand to hide it.
- **A skill/plugin divergence** is fixed in whichever emitter guesses. No tolerance is added
  without review.

## 5. Console MCP escalation

Only if Phase 1 needs it: bulk-generation too slow, variant-fidelity gaps, or rigorous automated visual
scoring beyond this skill → bring in Console MCP (batch tools + parity analysis). Not needed in run #1.

## Contracts

Reading, validating and changing contracts is described in `skill-figma-generate` (section
"Contracts: schema, commands, and how they land").

## References
- `tests/token-coverage.mjs` + `tests/fixtures/figma-variables.json` — the runnable coverage gate (co-located)
- `skill-figma-generate/tests/emitted-parity.test.ts` — the parity gate (runs in the generator's CI)
- `cloudflare/kumo` `packages/kumo-figma/src/generators/drift-detection.test.ts` (fork reference for the
  token-drift gate)
