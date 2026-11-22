/**
 * The deterministic core of the emitter.
 *
 * The emitter is the only impure layer — but the *decisions* it makes can still
 * be pure and tested. This module holds exactly those: how a DTCG token name
 * matches a Figma variable by name (the separator-stripped, camelCase-aware
 * rule), and the upsert reconciliation against `.agents/figma.json` (create vs
 * update-in-place vs skip-unchanged) that keeps re-runs non-destructive.
 *
 * `emit.ts` (the Figma Plugin API reference inlined into `use_figma`) imports
 * these so the only untested code is the thin `figma.createX()` glue. PURE: no
 * Figma I/O, no `Date`/random.
 */
import { tokensInAnatomy } from "./anatomy";
import { sizeVariablesInGeometry } from "./geometry";
import type { ComponentPlan } from "./plan";
import { tokensInViewport } from "./viewport";

// ---------- Bind-by-name (the variable match rule) ----------

/**
 * Normalise a name for variable matching. A DTCG slash-path token
 * (`color/primary-on-brand`) and a Figma variable name don't map naively —
 * multi-word segments are camelCased on one side. Strip every separator and
 * lowercase so both sides compare equal: `color/primary-on-brand` and
 * `color/primary/onBrand` both → `colorprimaryonbrand`.
 */
export function normalizeVarName(name: string): string {
  return name.replace(/[-/_]/g, "").toLowerCase();
}

/** Build a normalised lookup from a file's actual variable names → original name. */
export function indexVariablesByName(figmaVariableNames: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const n of figmaVariableNames) map.set(normalizeVarName(n), n);
  return map;
}

export interface BindMatch {
  /** The token name requested by the plan (e.g. `color/primary-brand`). */
  token: string;
  /** The matched Figma variable name, or null if none resolves (→ raw fallback). */
  variable: string | null;
}

/** Resolve a plan token to a concrete Figma variable name (or null → raw fallback). */
export function resolveBinding(token: string, index: Map<string, string>): BindMatch {
  return { token, variable: index.get(normalizeVarName(token)) ?? null };
}

// ---------- Text-style resolution (tier -> published composite style) ----------

/**
 * Read hyphens in a style reference as group separators: the top-level group prefix stays
 * intact and every remaining hyphen becomes `/` (`typography/paragraph-md` ->
 * `typography/paragraph/md`). Stems with no group are returned unchanged.
 */
export function normalizeStyleName(tokenRef: string): string {
  const slashIdx = tokenRef.indexOf("/");
  if (slashIdx === -1) return tokenRef;
  return `${tokenRef.slice(0, slashIdx)}/${tokenRef.slice(slashIdx + 1).replaceAll("-", "/")}`;
}

/** The part of a style name below its top-level group, hyphens read as separators. Case is kept. */
function tierKey(name: string): string {
  const normalized = normalizeStyleName(name);
  const slashIdx = normalized.indexOf("/");
  return slashIdx === -1 ? normalized : normalized.slice(slashIdx + 1);
}

export type TextStyleNameMatch = { kind: "found"; name: string } | { kind: "missing" } | { kind: "ambiguous"; candidates: string[] };

/**
 * Find the Figma text style a plan text-style reference means, among the style names a file has.
 *
 * A reference names a typography TIER (`typography/paragraph/md`), but the token sync publishes
 * each composite `typography` token under the composite's own path (`text-style/paragraph/md`),
 * and which group that is belongs to the token source, so it is read from the file's styles, never
 * hard-coded. Order: the exact name, then the hyphen-to-slash spelling, then the one style whose
 * name below its top-level group equals the tier's. Two such styles are ambiguous and match neither.
 *
 * Keep this identical to the Figma plugin's resolver; a parity test pins both over the same fixture.
 */
export function resolveTextStyleName(ref: string, availableNames: ReadonlySet<string>): TextStyleNameMatch {
  if (availableNames.has(ref)) return { kind: "found", name: ref };
  const normalized = normalizeStyleName(ref);
  if (availableNames.has(normalized)) return { kind: "found", name: normalized };
  const key = tierKey(ref);
  const candidates = [...availableNames].filter((name) => name.includes("/") && tierKey(name) === key).sort();
  if (candidates.length === 1) return { kind: "found", name: candidates[0] };
  if (candidates.length > 1) return { kind: "ambiguous", candidates };
  return { kind: "missing" };
}

/** The `documentationTheme` roles that bind a Figma VARIABLE (the rest bind text styles). */
export const DOCUMENTATION_VARIABLE_ROLES = ["page", "section", "text", "textSubtle", "divider", "radius", "rowGap", "contentGap", "sectionGap", "pageGutter"] as const;

/** Every distinct token a plan binds (deduped, stable order) — for a coverage pre-check. */
export function tokensInPlan(plan: ComponentPlan): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (v: string | undefined) => {
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  };
  for (const cell of plan.variantMatrix) {
    const geom = { ...plan.baseGeometry, ...cell.geometry };
    for (const v of [cell.bind.fill, cell.bind.text, cell.bind.stroke, geom.paddingInline, geom.paddingBlock, geom.paddingLeft, geom.paddingRight, geom.paddingTop, geom.paddingBottom, geom.gap, geom.radius, geom.borderTopWidth, geom.borderRightWidth, geom.borderBottomWidth, geom.borderLeftWidth]) {
      add(v);
    }
  }
  add(plan.radiusVar);
  const { chrome } = plan.documentation;
  for (const role of DOCUMENTATION_VARIABLE_ROLES) add(chrome[role]);
  for (const v of sizeVariablesInGeometry(plan.geometry)) add(v);
  for (const v of tokensInAnatomy(plan.cellAnatomy.map((tree) => tree ?? undefined))) add(v);
  for (const v of tokensInViewport(plan.viewport.map((frame) => frame ?? undefined))) add(v);
  return out;
}

// ---------- Upsert manifest (§8: preserve hand-content + bindings across re-runs) ----------

export interface ManifestEntry {
  component: string;
  /** Figma node id of the component's page-root frame (set by the emitter on create). */
  nodeId?: string;
  /** Slot/part component node ids, keyed by name (survive re-runs by id). */
  parts?: Record<string, string>;
  /** Stable hash of the plan that produced this entry — drives skip-unchanged. */
  planHash: string;
  /** Bumped on every update; 1 on first create. */
  version: number;
}

export interface FigmaManifest {
  fileKey: string;
  components: ManifestEntry[];
}

/**
 * Deterministic, dependency-free string hash (djb2) over the serialized plan.
 * Used only for change detection — not security — so a fast 32-bit hash is fine
 * and keeps the emitter free of `crypto`/runtime-specific APIs.
 */
export function planHash(plan: ComponentPlan): string {
  const s = JSON.stringify(plan);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return (h >>> 0).toString(16);
}

export type ReconcileAction = "create" | "update" | "skip";

export interface ReconcilePlan {
  component: string;
  action: ReconcileAction;
  /** The prior manifest entry (present for update/skip) — carries node ids to reuse. */
  prev?: ManifestEntry;
  /** The next manifest entry to persist after the emit. */
  next: ManifestEntry;
}

/**
 * Decide, per component, whether to create, update-in-place, or skip. Upsert by
 * component name (NOT destructive purge): an existing entry with the same plan
 * hash is `skip` (nothing changed); a changed hash is `update` (reuse its node
 * ids, bump version); an unseen component is `create`. `--destructive` mode is
 * the caller's choice and bypasses this (recreate everything).
 */
export function reconcileManifest(existing: FigmaManifest | null, plans: ComponentPlan[]): ReconcilePlan[] {
  const prevByName = new Map((existing?.components ?? []).map((e) => [e.component, e]));
  return plans.map((plan) => {
    const hash = planHash(plan);
    const prev = prevByName.get(plan.component);
    if (!prev) {
      return { component: plan.component, action: "create", next: { component: plan.component, planHash: hash, version: 1 } };
    }
    if (prev.planHash === hash) {
      return { component: plan.component, action: "skip", prev, next: prev };
    }
    return {
      component: plan.component,
      action: "update",
      prev,
      next: { ...prev, planHash: hash, version: prev.version + 1 },
    };
  });
}

// ---------- Embedded asset bytes (icons and images) ----------

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Decode base64 to bytes with no `Buffer` / `atob` dependency (neither is guaranteed in the Figma
 * plugin sandbox). Same decoder as the plugin walker's, so an embedded asset decodes identically.
 */
export function decodeBase64(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, "");
  const bytes = new Uint8Array(Math.floor((clean.length * 6) / 8));
  let byteIndex = 0;
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    buffer = (buffer << 6) | BASE64_CHARS.indexOf(char);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[byteIndex++] = (buffer >> bits) & 0xff;
    }
  }
  return bytes;
}

/** Decode UTF-8 bytes to a string (an embedded SVG asset's bytes are its markup). No `TextDecoder` dependency. */
export function decodeUtf8(bytes: Uint8Array): string {
  let result = "";
  let i = 0;
  while (i < bytes.length) {
    const b1 = bytes[i++];
    if (b1 < 0x80) {
      result += String.fromCharCode(b1);
    } else if (b1 >= 0xc0 && b1 < 0xe0) {
      result += String.fromCharCode(((b1 & 0x1f) << 6) | ((bytes[i++] ?? 0) & 0x3f));
    } else if (b1 >= 0xe0 && b1 < 0xf0) {
      const b2 = bytes[i++] ?? 0;
      const b3 = bytes[i++] ?? 0;
      result += String.fromCharCode(((b1 & 0x0f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f));
    } else {
      const b2 = bytes[i++] ?? 0;
      const b3 = bytes[i++] ?? 0;
      const b4 = bytes[i++] ?? 0;
      result += String.fromCodePoint(((b1 & 0x07) << 18) | ((b2 & 0x3f) << 12) | ((b3 & 0x3f) << 6) | (b4 & 0x3f));
    }
  }
  return result;
}
