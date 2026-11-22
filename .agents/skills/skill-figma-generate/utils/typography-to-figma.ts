/**
 * DTCG → Figma typography normalization (skill utility).
 *
 * WHY THIS EXISTS — finding from experiment run #1:
 * Figma applies a FLOAT variable bound to a text `lineHeight`/`letterSpacing` as **PIXELS**.
 * A DTCG lineHeight of `1.3` (unitless multiplier) therefore became `1.3px` and crushed the
 * text to ~2px tall. So unit-bearing typography props MUST be set RAW (resolved from the token),
 * NOT bound to the variable.
 *
 * DTCG SPEC NOTE: line-heights are px (`round({size} * ratio)`). Legacy unitless ratios (1.3) and
 * percent strings ("130%") are still accepted for old tokens.
 *
 * Binding policy for the generation skill:
 *   - fontSize   → BIND (FLOAT px maps cleanly)            e.g. setBoundVariable("fontSize", v)
 *   - fontWeight → BIND (numeric)                           e.g. setBoundVariable("fontWeight", v)
 *   - lineHeight → SET RAW via toFigmaLineHeight()          (do NOT bind)
 *   - letterSpacing → SET RAW via toFigmaLetterSpacing()    (do NOT bind)
 *   - fontFamily → SET RAW (Tokens Studio value is a CSS stack like ["Work Sans","sans-serif"],
 *                  which is not a valid Figma family — parse the first family, load, set fontName)
 */

export type FigmaLineHeight =
  | { unit: "PIXELS" | "PERCENT"; value: number }
  | { unit: "AUTO" };

export type FigmaLetterSpacing = { unit: "PIXELS" | "PERCENT"; value: number };

/**
 * DTCG lineHeight → Figma LineHeight.
 *
 * Canonical form is PX: the token export emits `round({size} * ratio)`, which resolves to a px number
 * (a bare number > 4, `"20px"`, or a `{ value, unit: "px" }` dimension). Px binds correctly in
 * Figma, while em/% line-heights export as FLOAT 0 / unbound PERCENT. Ratio inputs (`1.3`,
 * `"130%"`) are kept ONLY for legacy tokens.
 */
export function toFigmaLineHeight(
  token: number | string | { value: number | string; unit?: string } | null | undefined,
): FigmaLineHeight {
  const AUTO: FigmaLineHeight = { unit: "AUTO" };
  if (token == null) return AUTO;
  if (typeof token === "object") {
    const n = typeof token.value === "number" ? token.value : parseFloat(String(token.value));
    if (!Number.isFinite(n) || n <= 0) return AUTO;
    const unit = (token.unit ?? "px").toLowerCase();
    if (unit === "px") return { unit: "PIXELS", value: n };
    if (unit === "%") return { unit: "PERCENT", value: n };
    return { unit: "PERCENT", value: n * 100 }; // legacy em / unitless ratio
  }
  // Bare number: > 4 is a resolved px line-height (canonical); <= 4 is a legacy ratio (1.3).
  if (typeof token === "number") {
    if (!(token > 0)) return AUTO;
    return token > 4 ? { unit: "PIXELS", value: token } : { unit: "PERCENT", value: token * 100 };
  }
  const s = String(token).trim().toLowerCase();
  if (s === "normal" || s === "auto" || s === "") return AUTO;
  const n = parseFloat(s);
  if (!Number.isFinite(n) || n <= 0) return AUTO;
  if (s.endsWith("px")) return { unit: "PIXELS", value: n };
  if (s.endsWith("%")) return { unit: "PERCENT", value: n };
  if (s.endsWith("em")) return { unit: "PERCENT", value: n * 100 }; // legacy
  // bare numeric string: same rule as bare number (> 4 px, else legacy ratio)
  return n > 4 ? { unit: "PIXELS", value: n } : { unit: "PERCENT", value: n * 100 };
}

/** DTCG letterSpacing (number em OR string "0.02em"/"2%"/"1px") → Figma LetterSpacing. */
export function toFigmaLetterSpacing(token: number | string | null | undefined): FigmaLetterSpacing {
  const ZERO: FigmaLetterSpacing = { unit: "PERCENT", value: 0 };
  if (typeof token === "number") return Number.isFinite(token) ? { unit: "PERCENT", value: token * 100 } : ZERO;
  if (token == null) return ZERO;
  const s = String(token).trim().toLowerCase();
  const num = parseFloat(s);
  if (!Number.isFinite(num)) return ZERO; // malformed (e.g. "%", "px", "")
  if (s.endsWith("%")) return { unit: "PERCENT", value: num };
  if (s.endsWith("px")) return { unit: "PIXELS", value: num };
  if (s.endsWith("em")) return { unit: "PERCENT", value: num * 100 };
  return { unit: "PERCENT", value: num * 100 };
}

/** Tokens Studio fontFamily values are CSS stacks; take the first *concrete* family for Figma
 *  (skip generic CSS keywords like sans-serif/monospace which aren't loadable Figma fonts). */
const GENERIC_FAMILIES = new Set([
  "sans-serif", "serif", "monospace", "system-ui", "ui-sans-serif", "ui-serif",
  "ui-monospace", "ui-rounded", "cursive", "fantasy", "emoji", "math", "fangsong",
  "inherit", "initial", "unset",
]);
export function toFigmaFontFamily(token: string): string {
  // handles `["Work Sans","sans-serif"]`, `'Work Sans', sans-serif`, `Work Sans, sans-serif`
  const families = String(token)
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
  const concrete = families.find((f) => !GENERIC_FAMILIES.has(f.toLowerCase()));
  return concrete || families[0] || "Inter";
}
