import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FigmaVarType, ModeValue, TokenCollection, TokenModel, TokenVariable } from "./types";

/** Families whose token sets each map to a Figma MODE (rather than merging into one). */
const MULTI_MODE_FAMILIES: Record<string, true> = { theme: true, web: true };

export function defaultDtcgDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../../tokens/dtcg");
}

interface DtcgLeaf {
  pathKey: string; // slash-path, e.g. "color/border/subtle"
  value: unknown; // raw $value
  type?: string; // raw $type
}

interface DtcgMetadata {
  tokenSetOrder: string[];
}

export interface LoadResult {
  model: TokenModel;
  /** Slash-paths whose value is a Studio math expression we don't resolve here (theme ramps). */
  unresolved: string[];
}

/**
 * Load the project DTCG into a normalized `TokenModel`:
 * - one collection per token-set **family** (first path segment: brand, theme, semantic-web, …)
 * - modes = themes (`theme` → light/dark, `web` → sm/md/lg; every other family → a single "default")
 * - variables = leaf tokens by slash-path; pure `{ref}` → alias, literals → typed values.
 *
 * `theme/*` ramps are Studio math expressions (`set_chroma(set_lightness(…))`); those resolve via
 * the engine before a live push and are reported in `unresolved` until then.
 */
export type ColorParser = (value: string) => { r: number; g: number; b: number; a: number } | null;

export interface LoadOptions {
  /**
   * Parses a literal CSS colour to 0-1 rgba (null when it is not a literal). Colour tokens stay
   * unresolved without one, which is all a caller that only reads names and numbers needs; it keeps
   * this module free of a colour library so the project compiler can ship it as-is.
   */
  parseColor?: ColorParser;
  /**
   * Resolve a `theme/*` Studio math expression to a literal CSS color string for a given
   * mode (e.g. `"oklch(0.92 0.01 264)"`). Injected so this loader stays engine-decoupled;
   * the engine-backed resolver lives in `scripts/theme-resolver.ts` (`buildThemeResolver`).
   * Returns null → unresolved.
   *
   * `expression` is the raw Studio source (e.g. `best_contrast({theme.color.utility.error.9},
   * [...])`). A resolver that only keys off `pathKey` has to carry a hand-maintained list of
   * which tokens use which function — which is exactly how `best_contrast` arrived unhandled:
   * Studio changed seven `on*` tokens from plain aliases to `best_contrast(...)` and nothing
   * in the resolver knew the name had gained a meaning.
   */
  resolveColorExpression?: ColorExpressionResolver;
}

/**
 * The order token sets are merged in, the last write winning. The brand listed first in Studio's
 * `tokenSetOrder` is the default brand (Studio's order decides it, as it does the Figma mode order),
 * so that brand's sets merge last and supply the single-mode brand values. Other families keep
 * Studio's order.
 */
function mergeOrder(meta: DtcgMetadata): string[] {
  const brandOf = (setPath: string) =>
    setPath.startsWith("brand/") ? setPath.split("/")[1] : undefined;
  const firstBrand = meta.tokenSetOrder.map(brandOf).find((brand) => brand !== undefined);
  const isFirstBrand = (setPath: string) =>
    firstBrand !== undefined && brandOf(setPath) === firstBrand;
  return [
    ...meta.tokenSetOrder.filter((setPath) => !isFirstBrand(setPath)),
    ...meta.tokenSetOrder.filter(isFirstBrand),
  ];
}

export function loadDtcgModel(
  dtcgDir: string = defaultDtcgDir(),
  opts: LoadOptions = {},
): LoadResult {
  const meta = readJson<DtcgMetadata>(path.join(dtcgDir, "$metadata.json"));
  const unresolved: string[] = [];
  const literals = collectLiterals(dtcgDir, meta);

  // family → ordered set paths
  const families = new Map<string, string[]>();
  for (const setPath of mergeOrder(meta)) {
    const family = setPath.split("/")[0];
    const list = families.get(family) ?? [];
    list.push(setPath);
    families.set(family, list);
  }

  const collections: TokenCollection[] = [];
  for (const [family, setPaths] of families) {
    const multiMode = MULTI_MODE_FAMILIES[family] === true;
    const modes: string[] = [];
    // name → variable accumulator
    const byName = new Map<string, TokenVariable>();

    for (const setPath of setPaths) {
      const mode = multiMode ? (setPath.split("/")[1] ?? "default") : "default";
      if (!modes.includes(mode)) modes.push(mode);

      const json = readJsonOrNull<Record<string, unknown>>(path.join(dtcgDir, `${setPath}.json`));
      if (!json) continue;

      for (const leaf of walkLeaves(json)) {
        const type = figmaType(leaf.type, leaf.value);
        if (!type) continue; // composite (typography) / shadow → not a variable
        const mv = classifyValue(leaf.value, type, {
          unresolved,
          pathKey: leaf.pathKey,
          mode,
          resolve: opts.resolveColorExpression,
          parseColor: opts.parseColor ?? (() => null),
          literals,
        });
        let v = byName.get(leaf.pathKey);
        if (!v) {
          v = { name: leaf.pathKey, type, valuesByMode: {} };
          byName.set(leaf.pathKey, v);
        }
        if (mv) v.valuesByMode[mode] = mv;
      }
    }

    if (byName.size > 0) {
      collections.push({ name: family, modes, variables: [...byName.values()] });
    }
  }

  return { model: { collections }, unresolved };
}

export function dtcgVariableNames(tree: Record<string, unknown>): string[] {
  const names: string[] = [];
  for (const leaf of walkLeaves(tree)) {
    if (figmaType(leaf.type, leaf.value)) {
      names.push(leaf.pathKey);
    } else if (leaf.type === "typography" && leaf.value && typeof leaf.value === "object") {
      for (const property of Object.keys(leaf.value as Record<string, unknown>)) {
        names.push(`${leaf.pathKey}/${property}`);
      }
    }
  }
  return names;
}

/** Every variable name across the project's DTCG token sets (`$metadata.tokenSetOrder`), sorted and deduplicated. */
export function loadDtcgVariableNames(dtcgDir: string = defaultDtcgDir()): string[] {
  const meta = readJson<DtcgMetadata>(path.join(dtcgDir, "$metadata.json"));
  const names = new Set<string>();
  for (const setPath of meta.tokenSetOrder) {
    const json = readJsonOrNull<Record<string, unknown>>(path.join(dtcgDir, `${setPath}.json`));
    if (!json) continue;
    for (const name of dtcgVariableNames(json)) names.add(name);
  }
  return [...names].sort();
}

/**
 * One composite `typography` token. Tokens Studio Companion publishes each of these as a
 * Figma TEXT STYLE named by its slash-path (`text-style/paragraph/md`), never as variables.
 */
export interface DtcgTextStyleComposite {
  /** The Figma text style name Companion publishes: the token's slash-path. */
  name: string;
  /** The token set that defines it (`semantic-web/typography`). */
  set: string;
  /**
   * The property-group path every property of the composite references, slash-separated
   * (`typography/paragraph/md` when each property is `{typography.paragraph.md.<prop>}`).
   * Undefined when the properties reference no single group (literals or a mix).
   */
  tier?: string;
}

/** PURE. Every composite `typography` token in one DTCG token set. */
export function dtcgTextStyleComposites(
  tree: Record<string, unknown>,
  set: string,
): DtcgTextStyleComposite[] {
  const composites: DtcgTextStyleComposite[] = [];
  for (const leaf of walkLeaves(tree)) {
    if (leaf.type !== "typography" || !leaf.value || typeof leaf.value !== "object") continue;
    const tiers = new Set<string>();
    let allReferences = true;
    for (const [property, raw] of Object.entries(leaf.value as Record<string, unknown>)) {
      const match = typeof raw === "string" ? REF_RE.exec(raw.trim()) : null;
      const suffix = `.${property}`;
      if (!match?.[1].endsWith(suffix)) {
        allReferences = false;
        break;
      }
      tiers.add(match[1].slice(0, -suffix.length).replaceAll(".", "/"));
    }
    const tier = allReferences && tiers.size === 1 ? [...tiers][0] : undefined;
    composites.push({ name: leaf.pathKey, set, ...(tier ? { tier } : {}) });
  }
  return composites;
}

/** Every composite `typography` token across the project's DTCG token sets, in set order. */
export function loadDtcgTextStyleComposites(
  dtcgDir: string = defaultDtcgDir(),
): DtcgTextStyleComposite[] {
  const meta = readJson<DtcgMetadata>(path.join(dtcgDir, "$metadata.json"));
  const composites: DtcgTextStyleComposite[] = [];
  for (const setPath of meta.tokenSetOrder) {
    const json = readJsonOrNull<Record<string, unknown>>(path.join(dtcgDir, `${setPath}.json`));
    if (!json) continue;
    composites.push(...dtcgTextStyleComposites(json, setPath));
  }
  return composites;
}

/**
 * Walk a DTCG tree to its `$value` leaves, building slash-path names. Tokens Studio allows a node to
 * be BOTH a token and a group — it carries `$value` AND nested child tokens (e.g. `color.surface` is
 * `{neutral.5}` and also has `surface.recessed`, `surface.body`). So when a node has a `$value`
 * we emit it as a leaf AND still recurse into its non-`$` children — never stop at the value, or the
 * nested tokens silently vanish.
 */
function walkLeaves(node: Record<string, unknown>, prefix: string[] = []): DtcgLeaf[] {
  const out: DtcgLeaf[] = [];
  for (const [key, raw] of Object.entries(node)) {
    if (key.startsWith("$")) continue;
    if (!raw || typeof raw !== "object") continue;
    const obj = raw as Record<string, unknown>;
    if ("$value" in obj) {
      const leaf = obj as { $value: unknown; $type?: string };
      out.push({ pathKey: [...prefix, key].join("/"), value: leaf.$value, type: leaf.$type });
    }
    // Recurse into nested child tokens even when this node is itself a token (value-and-group).
    if (Object.keys(obj).some((k) => !k.startsWith("$"))) {
      out.push(...walkLeaves(obj, [...prefix, key]));
    }
  }
  return out;
}

// Numeric / string / composite DTCG `$type`s. Driving off `$type` (not the value) is essential:
// an aliased token (`$value: "{ref}"`) still carries its real `$type`, and Figma requires an alias
// and its target to share a resolvedType — so a `borderRadius` alias must type as FLOAT, not STRING.
const FLOAT_TYPES = new Set([
  "dimension",
  "sizing",
  "spacing",
  "borderRadius",
  "borderWidth",
  "opacity",
  "fontSizes",
  "fontSize",
  "fontWeights",
  "fontWeight",
  "lineHeights",
  "lineHeight",
  "letterSpacing",
  "paragraphSpacing",
  "number",
  "zIndex",
]);
const STRING_TYPES = new Set([
  "fontFamilies",
  "fontFamily",
  "textCase",
  "textDecoration",
  "string",
  "duration",
]);
const SKIP_TYPES = new Set(["typography", "boxShadow", "cubicBezier", "border", "shadow", "asset"]);

/** Map a DTCG `$type` (preferred) + value shape to a Figma resolved type, or null to skip. */
function figmaType(dtcgType: string | undefined, value: unknown): FigmaVarType | null {
  if (dtcgType === "color") return "COLOR";
  if (dtcgType === "boolean") return "BOOLEAN";
  if (dtcgType && SKIP_TYPES.has(dtcgType)) return null;
  if (dtcgType && FLOAT_TYPES.has(dtcgType)) return "FLOAT";
  if (dtcgType && STRING_TYPES.has(dtcgType)) return "STRING";
  // No / unknown $type → infer from the value shape.
  if (typeof value === "boolean") return "BOOLEAN";
  if (typeof value === "object" && value !== null) return null; // composite / array
  if (typeof value === "number") return "FLOAT";
  if (typeof value === "string") return isNumericDimension(value) ? "FLOAT" : "STRING";
  return null;
}

const REF_RE = /^\{([^}]+)\}$/;
const NUMERIC_RE = /^-?\d+(\.\d+)?$/;
const DIMENSION_RE = /^(-?\d+(?:\.\d+)?)(px|rem|em|%)$/;

function isNumericDimension(s: string): boolean {
  const t = s.trim();
  return NUMERIC_RE.test(t) || DIMENSION_RE.test(t);
}

/**
 * Engine hook for Studio colour math the loader leaves unresolved. `literals` is the pre-pass
 * `slashPath → literal` map (e.g. so `set_alpha(…, {brand.opacity.10})` can read the opacity value).
 */
export type ColorExpressionResolver = (
  pathKey: string,
  mode: string,
  expression: string,
  literals: ReadonlyMap<string, unknown>,
) => string | null;

interface ClassifyCtx {
  unresolved: string[];
  pathKey: string;
  mode: string;
  resolve?: ColorExpressionResolver;
  parseColor: ColorParser;
  /** Pre-pass literal map for resolving set_alpha() and arithmetic expressions inline. */
  literals: Map<string, unknown>;
}

/** Classify a raw `$value` into a Figma mode value, or undefined if unresolved/skipped. */
function classifyValue(raw: unknown, type: FigmaVarType, ctx: ClassifyCtx): ModeValue | undefined {
  if (typeof raw === "boolean") return { kind: "boolean", value: raw };
  if (typeof raw === "number") return { kind: "float", value: raw };
  if (typeof raw !== "string") return undefined;

  const s = raw.trim();
  const ref = REF_RE.exec(s);
  if (ref) return { kind: "alias", targetVar: ref[1].replace(/\./g, "/") };

  if (type === "COLOR") {
    const rgba = ctx.parseColor(s);
    if (rgba) return { kind: "color", ...rgba };
    // set_alpha({ref}, alphaRefOrLiteral) — resolved from the pre-pass literal map.
    const setAlpha = tryResolveSetAlpha(s, ctx.literals, ctx.parseColor);
    if (setAlpha) return { kind: "color", ...setAlpha };
    // Remaining Studio math (to_gamut/set_lightness/chroma/…) — try injected engine resolver.
    const resolved = ctx.resolve?.(ctx.pathKey, ctx.mode, s, ctx.literals);
    if (resolved) {
      const r = ctx.parseColor(resolved);
      if (r) return { kind: "color", ...r };
    }
    ctx.unresolved.push(ctx.pathKey);
    return undefined;
  }

  if (type === "FLOAT") {
    const num = numericValue(s);
    if (num !== null) return { kind: "float", value: num };
    // {ref} * N  or  round({ref} * N) — resolved from the pre-pass literal map.
    const arith = tryResolveArithmetic(s, ctx.literals);
    if (arith !== undefined) return { kind: "float", value: arith };
    // Remaining Studio expressions (e.g. set_lightness-based) — skip for FLOAT vars.
    ctx.unresolved.push(ctx.pathKey);
    return undefined;
  }

  return { kind: "string", value: s };
}

// ── Expression resolvers (pre-pass literal map required) ─────────────────────

/**
 * Pre-pass: walk all DTCG files and build a `slashPath → resolved literal` map,
 * transitively following single-ref aliases (up to depth 10).
 * Used so `set_alpha()` and arithmetic expressions can resolve inline without the engine.
 */
function collectLiterals(dtcgDir: string, meta: DtcgMetadata): Map<string, unknown> {
  const raw = new Map<string, unknown>();
  for (const setPath of mergeOrder(meta)) {
    const json = readJsonOrNull<Record<string, unknown>>(path.join(dtcgDir, `${setPath}.json`));
    if (!json) continue;
    for (const leaf of walkLeaves(json)) raw.set(leaf.pathKey, leaf.value);
  }
  const resolved = new Map<string, unknown>();
  const resolveOne = (key: string, seen = new Set<string>()): unknown => {
    if (resolved.has(key)) return resolved.get(key);
    if (seen.has(key)) return raw.get(key); // cycle guard
    const val = raw.get(key);
    if (typeof val === "string") {
      const r = REF_RE.exec(val.trim());
      if (r) {
        seen.add(key);
        const t = resolveOne(r[1].replace(/\./g, "/"), seen);
        resolved.set(key, t);
        return t;
      }
    }
    resolved.set(key, val);
    return val;
  };
  for (const key of raw.keys()) resolveOne(key);
  return resolved;
}

/** Resolve `set_alpha({colorRef}, alphaRefOrLiteral)` → rgba or undefined. */
function tryResolveSetAlpha(
  s: string,
  literals: Map<string, unknown>,
  parseColor: ColorParser,
): { r: number; g: number; b: number; a: number } | undefined {
  const m = /^set_alpha\(\s*(\{[^}]+\})\s*,\s*(\{[^}]+\}|[\d.]+)\s*\)$/.exec(s);
  if (!m) return undefined;
  const colorRaw = literals.get(m[1].slice(1, -1).replace(/\./g, "/"));
  if (typeof colorRaw !== "string") return undefined;
  const color = parseColor(colorRaw);
  if (!color) return undefined;
  const alphaStr = m[2].trim();
  const alphaRef = REF_RE.exec(alphaStr);
  let alpha: number | undefined;
  if (alphaRef) {
    const v = literals.get(alphaRef[1].replace(/\./g, "/"));
    if (typeof v === "number") alpha = v;
    else if (typeof v === "string") {
      const n = numericValue(v);
      if (n !== null) alpha = n;
    }
  } else {
    const n = Number(alphaStr);
    if (!Number.isNaN(n)) alpha = n;
  }
  if (alpha === undefined) return undefined;
  return { ...color, a: Math.min(1, Math.max(0, alpha)) };
}

/** Resolve simple DTCG arithmetic (`*`, `+`, `-`, `round`, `round_to`, `max`) → float. */
function tryResolveArithmetic(s: string, literals: Map<string, unknown>): number | undefined {
  return tryResolveArithmeticExpression(s, literals, new Set<string>());
}

function tryResolveArithmeticExpression(
  s: string,
  literals: Map<string, unknown>,
  seen: Set<string>,
): number | undefined {
  const t = s.trim();
  const additive = /^(\{[^}]+\}|-?[\d.]+)\s*([+-])\s*(\{[^}]+\}|-?[\d.]+)$/.exec(t);
  if (additive) {
    const left = resolveArithmeticOperand(additive[1], literals, seen);
    const right = resolveArithmeticOperand(additive[3], literals, seen);
    if (left === undefined || right === undefined) return undefined;
    return additive[2] === "+" ? left + right : left - right;
  }
  const maxCall = /^max\((.*)\)$/.exec(t);
  if (maxCall) {
    let depth = 0;
    let separator = -1;
    for (let i = 0; i < maxCall[1].length; i++) {
      const char = maxCall[1][i];
      if (char === "(") depth++;
      if (char === ")") depth--;
      if (char === "," && depth === 0) {
        if (separator !== -1) return undefined;
        separator = i;
      }
      if (depth < 0) return undefined;
    }
    if (separator === -1 || depth !== 0) return undefined;
    const resolve = (operand: string) => {
      const value = operand.trim();
      if (/^\{[^}]+\}$/.test(value)) {
        return resolveNumericReference(value, literals, new Set(seen));
      }
      return numericValue(value) ?? tryResolveArithmeticExpression(value, literals, new Set(seen));
    };
    const left = resolve(maxCall[1].slice(0, separator));
    const right = resolve(maxCall[1].slice(separator + 1));
    return left === undefined || right === undefined ? undefined : Math.max(left, right);
  }
  const m =
    /^(?:(round|round_to)\(\s*)?(\{[^}]+\})\s*\*\s*(\{[^}]+\}|-?[\d.]+)(?:\s*,\s*(\d+))?\s*\)?$/.exec(
      t,
    );
  if (!m) return undefined;
  // Each operand gets its own cycle guard: both may depend on the same base token.
  const refVal = resolveNumericReference(m[2], literals, new Set(seen));
  const factor = m[3].startsWith("{")
    ? resolveNumericReference(m[3], literals, new Set(seen))
    : Number(m[3]);
  if (factor === undefined || Number.isNaN(factor)) return undefined;
  if (refVal === undefined) return undefined;
  const result = refVal * factor;
  if (m[1] === "round") return Math.round(result);
  if (m[1] === "round_to") {
    const digits = Number(m[4]);
    return Number(result.toFixed(digits));
  }

  function resolveArithmeticOperand(
    operand: string,
    literals: Map<string, unknown>,
    seen: Set<string>,
  ): number | undefined {
    if (operand.startsWith("{")) {
      // Both operands may legitimately depend on the same base token (for example,
      // radius.default - spacing.050). Give each resolution branch its own cycle guard.
      return resolveNumericReference(operand, literals, new Set(seen));
    }
    const value = Number(operand);
    return Number.isNaN(value) ? undefined : value;
  }
  return result;
}

/** Resolve a literal numeric token or its arithmetic formula, following references recursively. */
function resolveNumericReference(
  reference: string,
  literals: Map<string, unknown>,
  seen = new Set<string>(),
): number | undefined {
  const key = reference.slice(1, -1).replace(/\./g, "/");
  if (seen.has(key)) return undefined;
  seen.add(key);

  const raw = literals.get(key);
  if (typeof raw === "number") return raw;
  if (typeof raw !== "string") return undefined;

  const numeric = numericValue(raw);
  if (numeric !== null) return numeric;
  if (/^\{[^}]+\}$/.test(raw.trim())) return resolveNumericReference(raw.trim(), literals, seen);
  return tryResolveArithmeticExpression(raw, literals, seen);
}

function numericValue(s: string): number | null {
  const t = s.trim();
  if (NUMERIC_RE.test(t)) return Number(t);
  const dim = DIMENSION_RE.exec(t);
  if (dim) return Number(dim[1]);
  return null;
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

/** Read JSON, returning null only for a missing file. Malformed JSON throws (don't silently drop a set). */
function readJsonOrNull<T>(file: string): T | null {
  try {
    return readJson<T>(file);
  } catch (e) {
    if ((e as { code?: string }).code === "ENOENT") return null;
    throw new Error(`Malformed token set ${file}: ${(e as Error).message}`);
  }
}
