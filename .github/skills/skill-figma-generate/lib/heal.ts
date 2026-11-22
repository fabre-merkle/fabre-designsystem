// Heal — normalize Figma state the token pipeline / variable model can't express.
//
// Some design-token semantics don't survive the trip into Figma variables. The
// first (and motivating) case is LINE-HEIGHT: Figma variables are typed
// COLOR/FLOAT/STRING — there is no "percent" type — so a `130%` line-height token
// becomes a FLOAT `1.3`, and a line-height *bound* to a FLOAT renders as PIXELS
// (`1.3px`), collapsing the text. Figma DOES support `%` line-height natively; only
// the *binding* forces px. The fix is to set line-height RAW as PERCENT (unbound),
// re-expressing `1.3` → `130%`.
//
// Healers are PURE (no Figma I/O) so they unit-test and inline into the `use_figma`
// script exactly like `emit.ts`. Extend `STYLE_HEALERS` as new Figma-model quirks
// surface (e.g. letter-spacing em↔px, effect-color rounding, …) — each healer is a
// named detector + a patch, and the emitter applies the patch (unbind → set raw).

export interface FigmaLineHeight {
  unit: "PIXELS" | "PERCENT" | "AUTO";
  value?: number;
}

/**
 * A `PIXELS` line-height below this is really a bound-FLOAT *ratio* (≈1.0–3.0), not
 * a genuine px line-height — the fingerprint of the percent→FLOAT→px collapse. A
 * real pixel line-height (16, 24, 64…) is never this small; a legitimate per-size
 * px token (see the runbook's Pattern 2) stays > this and is left untouched.
 */
export const RATIO_PX_CEILING = 4;

/** True when a line-height is the collapsed bound-FLOAT-as-px bug (e.g. `1.3px`). */
export function isRatioAsPx(lh: FigmaLineHeight | null | undefined): boolean {
  return (
    !!lh &&
    lh.unit === "PIXELS" &&
    typeof lh.value === "number" &&
    lh.value > 0 &&
    lh.value < RATIO_PX_CEILING
  );
}

/**
 * Re-express the collapsed ratio as the PERCENT Figma renders proportionally
 * (`1.3` → `130%`). Rounded to 0.1% to shed float noise (`1.2999996` → `130`).
 */
export function ratioToPercent(ratio: number): FigmaLineHeight {
  return { unit: "PERCENT", value: Math.round(ratio * 1000) / 10 };
}

/**
 * The patch a healer wants applied to a text style: values to set, plus variable
 * fields to UNBIND first (a bound value can't be overridden while it stays bound).
 */
export interface StyleHealPatch {
  set?: { lineHeight?: FigmaLineHeight };
  unbind?: Array<"lineHeight" | "letterSpacing" | "fontSize" | "fontWeight">;
}

/** Minimal view of a Figma text style a healer inspects (matches the Plugin API). */
export interface HealableStyle {
  name: string;
  lineHeight?: FigmaLineHeight;
  boundVariables?: { lineHeight?: { id: string } } | null;
}

export interface StyleHealer {
  /** Stable id — also the fidelity-check assertion key. */
  name: string;
  /** Why the quirk exists — surfaced in reports + docs. */
  reason: string;
  /** True when `style` exhibits the quirk. */
  detect(style: HealableStyle): boolean;
  /** The patch to apply when `detect` is true. */
  heal(style: HealableStyle): StyleHealPatch;
}

export const lineHeightHealer: StyleHealer = {
  name: "line-height-ratio-to-percent",
  reason:
    "Figma variables have no percent type: a % line-height token becomes a FLOAT (1.3), and a bound FLOAT line-height renders as PIXELS. Re-express it as raw PERCENT — Figma supports % line-height natively; only the variable binding forces px.",
  detect: (s) => isRatioAsPx(s.lineHeight),
  heal: (s) => ({
    set: { lineHeight: ratioToPercent((s.lineHeight as FigmaLineHeight).value ?? 0) },
    unbind: ["lineHeight"],
  }),
};

/** Registry of style healers, applied in order. Extend as new quirks surface. */
export const STYLE_HEALERS: StyleHealer[] = [lineHeightHealer];

export interface HealAction {
  style: string;
  healer: string;
  patch: StyleHealPatch;
}

/**
 * Compute the heal actions for a set of text styles (PURE — the emitter applies
 * each `patch` via `use_figma`: unbind the listed fields, then set the raw values).
 * Returns one action per (style, matching healer).
 */
export function planStyleHeals(styles: HealableStyle[]): HealAction[] {
  const actions: HealAction[] = [];
  for (const style of styles) {
    for (const healer of STYLE_HEALERS) {
      if (healer.detect(style)) {
        actions.push({ style: style.name, healer: healer.name, patch: healer.heal(style) });
      }
    }
  }
  return actions;
}
