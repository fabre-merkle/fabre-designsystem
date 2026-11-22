import { resolveIconSvg } from "../icons";
import {
  type PseudoElementSuffix,
  resolvePseudoPart,
  resolveVariantBindingsWithRefusals,
} from "../registry/resolver";
import { isStandardStateAxis } from "../registry/state-axis";
import type {
  ComponentRegistryAxis,
  ComponentRegistryEntry,
  ResolveAnatomy,
} from "../registry/types";
import {
  type FigmaLayoutManifestEntry,
  RESOLVED_PLAN_SCHEMA_VERSION,
  type ResolvedComponentPlan,
  type ResolvedDimension,
  type ResolvedPlanCell,
  type ResolvedPlanGeometry,
} from "./types";

const FORBIDDEN_LAYOUT_MANIFEST_KEYS = [
  "fill",
  "stroke",
  "text",
  "effectStyle",
  "paddingInline",
  "paddingBlock",
  "paddingLeft",
  "paddingRight",
  "paddingTop",
  "paddingBottom",
  "gap",
  "radius",
  "borderWidth",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "opacity",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "textStyle",
] as const;

/** Throws if `entry` carries any paint/spacing/typography key — see the constant above. */
function assertNoForbiddenLayoutFields(part: string, entry: FigmaLayoutManifestEntry): void {
  const found = FORBIDDEN_LAYOUT_MANIFEST_KEYS.filter((key) => key in entry);
  if (found.length > 0) {
    throw new Error(
      `Layout manifest entry for "${part}" carries forbidden paint/spacing field(s): ${found.join(", ")}. ` +
        "The layout manifest may only declare width/height/aspectRatio — those stay CSS-derived.",
    );
  }
}

/**
 * Does `current` leave room for a manifest declaration? A manifest entry may
 * only fill what the CSS resolver left ABSENT or REFUSED — never overwrite a
 * real `variable`/`literal` binding it already produced. This is what keeps
 * "CSS remains the sole source of truth for what IS in the source" true: the
 * manifest only ever fills presence, never overwrites it.
 *
 * `fill` (`100%`) is included as overridable because, structurally, nothing
 * this generator ever materializes is a genuine auto-layout FILL child at its
 * OWN root — every component-set variant root, and every "overlay" anatomy
 * child, fails `layoutSizing* = "FILL"` at materialize time
 * (`node-walker.ts`'s `applyAxisSizing`) — so a CSS `100%` on the merged
 * root/overlay geometry is honestly unrealisable as written, not a working
 * binding this would clobber.
 */
function overridableByManifest(current: ResolvedDimension | undefined): boolean {
  return current === undefined || current.kind === "fill" || current.kind === "unsupported";
}

/**
 * Applies one declared layout size to a current dimension the CSS left absent, refused or set to
 * `fill`. `hug` replaces only a refused size. `literal` replaces any of the three, `fill` included.
 * `matchRoot` replaces any of the three with the root's dimension on the same axis, which is
 * absent when the root has none.
 */
function applyLayoutDimension(
  current: ResolvedDimension | undefined,
  declared: FigmaLayoutManifestEntry["width"] | FigmaLayoutManifestEntry["height"],
  rootDimension: ResolvedDimension | undefined,
): ResolvedDimension | undefined {
  if (!declared || !overridableByManifest(current)) return current;
  // `hug` supersedes a REFUSED CSS size only. An absent dimension already
  // hugs (nothing to declare) and a `fill` is a different, realisable intent
  // that the declaration must not silently reinterpret.
  if (declared.kind === "hug") {
    return current?.kind === "unsupported" ? { kind: "hug" } : current;
  }
  if (declared.kind === "literal") return { kind: "literal", px: declared.px };
  // `matchRoot`: fall through to whatever the root resolved on this same axis
  // (itself already manifest-applied by the time this runs — see call order
  // in `buildResolvedComponentPlan`). `undefined` if the root has no answer
  // either; that's still honest — nothing invented.
  return rootDimension;
}

/**
 * Merge one manifest entry into one cell's geometry, per-axis, per the
 * precedence in `overridableByManifest`. Returns the SAME object when nothing
 * changed (cheap no-op check the caller can use to avoid reallocating).
 */
function applyLayoutManifestToGeometry(
  geometry: ResolvedPlanGeometry,
  entry: FigmaLayoutManifestEntry | undefined,
  rootGeometry: ResolvedPlanGeometry | undefined,
): ResolvedPlanGeometry {
  if (!entry) return geometry;
  const width = applyLayoutDimension(geometry.width, entry.width, rootGeometry?.width);
  const height = applyLayoutDimension(geometry.height, entry.height, rootGeometry?.height);
  const aspectRatio = entry.aspectRatio ?? geometry.aspectRatio;
  if (
    width === geometry.width &&
    height === geometry.height &&
    aspectRatio === geometry.aspectRatio
  ) {
    return geometry;
  }
  return {
    ...geometry,
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(aspectRatio !== undefined ? { aspectRatio } : {}),
  };
}

/**
 * A component with zero design-facing axes (e.g. an anchored popup like Popover/Tooltip that has
 * exactly one shown state) resolves a single cell with an empty `key` — `labelOf({})` must not
 * collapse to "", which the generation-contract validator rejects as a non-empty-string violation.
 */
function labelOf(key: Record<string, string>): string {
  const entries = Object.entries(key);
  if (entries.length === 0) return "default";
  return entries.map(([k, v]) => `${k}=${v}`).join(", ");
}

/**
 * The icon a checkbox draws for a state (check when checked, minus when indeterminate), or
 * `undefined`.
 */
function checkboxIconForCell(
  entry: ComponentRegistryEntry,
  key: Record<string, string>,
): Pick<ResolvedPlanCell, "iconName" | "iconSvg"> | undefined {
  if (entry.rootPart !== "checkbox") return undefined;
  const state = key.checked;
  const iconName = state === "checked" ? "Check" : state === "indeterminate" ? "Minus" : undefined;
  if (!iconName) return undefined;
  const iconSvg = resolveIconSvg(iconName);
  if (!iconSvg) return undefined;
  return { iconName, iconSvg };
}

export interface BuildResolvedComponentPlanOptions {
  /** Override which axes to resolve/cartesian over (default: the entry's own axes). */
  axes?: ComponentRegistryAxis[];
  layoutManifest?: Record<string, FigmaLayoutManifestEntry>;
  pseudoParts?: Array<{ part: string; hostPart: string; pseudo: PseudoElementSuffix }>;
  /**
   * The contract's anatomy, which lets the resolver evaluate `:has()` and position pseudo-classes
   * against the parts each cell renders. Omitted, those rules are left unapplied, as before.
   */
  anatomy?: ResolveAnatomy;
}

/** PURE. `(registryEntry) → ResolvedComponentPlan`, same inputs → byte-identical output. */
export function buildResolvedComponentPlan(
  entry: ComponentRegistryEntry,
  options: BuildResolvedComponentPlanOptions = {},
): ResolvedComponentPlan {
  const axes = options.axes ?? entry.axes;
  const rootResolution = resolveVariantBindingsWithRefusals(entry, axes, options.anatomy);
  const resolved = rootResolution.cells;
  const refusedNegations: Record<string, string> = {};
  const refusedMargins: Record<string, string> = {};
  const radiusFallbacks: Record<string, string> = {};
  for (const [fragment, reason] of rootResolution.refusedNegations) {
    refusedNegations[fragment] = reason;
  }
  for (const [key, reason] of rootResolution.refusedMargins) refusedMargins[key] = reason;
  for (const [key, reason] of rootResolution.radiusFallbacks) radiusFallbacks[key] = reason;

  const rootManifestEntry = options.layoutManifest?.[entry.rootPart];
  if (rootManifestEntry) assertNoForbiddenLayoutFields(entry.rootPart, rootManifestEntry);
  // `matchRoot` on the root itself is a no-op (nothing to match against but
  // itself), so the root pass never needs a `rootGeometry` argument.
  const resolvedWithManifest = rootManifestEntry
    ? resolved.map((cell) => {
        if (
          rootManifestEntry.when &&
          !Object.entries(rootManifestEntry.when).every(([k, v]) => cell.key[k] === v)
        ) {
          return cell;
        }
        return {
          ...cell,
          geometry: applyLayoutManifestToGeometry(cell.geometry, rootManifestEntry, undefined),
        };
      })
    : resolved;

  const variantMatrix: ResolvedPlanCell[] = resolvedWithManifest.map((cell) => ({
    key: cell.key,
    label: labelOf(cell.key),
    bind: cell.bind,
    ...(checkboxIconForCell(entry, cell.key) ?? {}),
    ...(Object.keys(cell.geometry).length > 0 ? { geometry: cell.geometry } : {}),
  }));

  // The standard State axis runs across the columns, as Figma's component grid convention has it;
  // rows are the first other axis. Without one, the first two axes are rows and columns.
  const stateAxis = axes.find(isStandardStateAxis);
  const otherAxes = axes.filter((axis) => axis !== stateAxis);
  const gridLabels = stateAxis
    ? { rows: otherAxes[0]?.values ?? [], cols: stateAxis.values }
    : axes.length >= 1
      ? { rows: axes[0].values, cols: axes[1]?.values ?? [] }
      : null;

  // Base geometry = the geometry resolved for the FIRST cell (the default of every
  // axis). Per-cell `geometry` (set above, when non-empty) carries that cell's full
  // resolved geometry — the walker can diff against `baseGeometry` itself if it only
  // wants overrides; this schema doesn't presume that policy.
  //
  // A key that some other cell does NOT set is left out of the base. Consumers read a
  // cell as `{ ...baseGeometry, ...cell.geometry }`, so a base key missing from a cell
  // would be inherited by it: ToggleGroup's `height` exists only on the horizontal
  // joined cells, and every vertical or gapped cell inherited it, squashing three
  // stacked items into one control height. Every cell carries its full geometry, so
  // dropping the key from the base loses nothing for the cells that do set it.
  const firstGeometry = resolvedWithManifest[0]?.geometry ?? {};
  const baseGeometry = Object.fromEntries(
    Object.entries(firstGeometry).filter(([key]) =>
      resolvedWithManifest.every((cell) => key in cell.geometry),
    ),
  ) as typeof firstGeometry;

  // Resolve sub-part binding matrices (T2-2). For each named sub-part, re-run the
  // resolver over the same axes but with that part as the rootPart. The resolver
  // validates parent constraints in descendant/child selectors against these axes.
  const partBindings: Record<string, ResolvedPlanCell[]> = {};
  for (const partName of entry.parts) {
    if (partName === entry.rootPart) continue;
    const partEntry = {
      ...entry,
      rootPart: partName,
      componentRoot: entry.componentRoot ?? entry.rootPart,
    };
    const partResolution = resolveVariantBindingsWithRefusals(partEntry, axes, options.anatomy);
    const partResolved = partResolution.cells;
    for (const [fragment, reason] of partResolution.refusedNegations) {
      refusedNegations[fragment] = reason;
    }
    for (const [key, reason] of partResolution.refusedMargins) refusedMargins[key] = reason;
    for (const [key, reason] of partResolution.radiusFallbacks) radiusFallbacks[key] = reason;
    const partManifestEntry = options.layoutManifest?.[partName];
    if (partManifestEntry) assertNoForbiddenLayoutFields(partName, partManifestEntry);
    const partResolvedWithManifest = partManifestEntry
      ? partResolved.map((cell, i) => {
          if (
            partManifestEntry.when &&
            !Object.entries(partManifestEntry.when).every(([k, v]) => cell.key[k] === v)
          ) {
            return cell;
          }
          return {
            ...cell,
            // Index-aligned with `resolvedWithManifest`: both are `cartesian(axes)`
            // over the SAME `axes` array, in the same deterministic order (see the
            // module doc on `ResolvedComponentPlan.partBindings`).
            geometry: applyLayoutManifestToGeometry(
              cell.geometry,
              partManifestEntry,
              resolvedWithManifest[i]?.geometry,
            ),
          };
        })
      : partResolved;
    const hasBinding = partResolvedWithManifest.some(
      (c) =>
        c.bind.fill !== undefined ||
        c.bind.text !== undefined ||
        c.bind.stroke !== undefined ||
        c.bind.effectStyle !== undefined ||
        c.bind.strokeFromText !== undefined ||
        Object.keys(c.geometry).length > 0,
    );
    if (hasBinding) {
      partBindings[partName] = partResolvedWithManifest.map((cell) => ({
        key: cell.key,
        label: labelOf(cell.key),
        bind: cell.bind,
        ...(Object.keys(cell.geometry).length > 0 ? { geometry: cell.geometry } : {}),
      }));
    }
  }

  const pseudoParts: string[] = [];
  const refusedPseudoParts: Record<string, string> = {};
  for (const { part, hostPart, pseudo } of options.pseudoParts ?? []) {
    const result = resolvePseudoPart(entry, hostPart, pseudo, axes);
    if (result.kind === "refused") {
      refusedPseudoParts[part] = result.reason;
      continue;
    }
    pseudoParts.push(part);
    for (const [key, reason] of result.refusedMargins) refusedMargins[key] = reason;
    for (const [key, reason] of result.radiusFallbacks) radiusFallbacks[key] = reason;
    partBindings[part] = result.cells.map((cell) => ({
      key: cell.key,
      label: labelOf(cell.key),
      bind: cell.bind,
      ...(Object.keys(cell.geometry).length > 0 ? { geometry: cell.geometry } : {}),
    }));
  }

  return {
    schemaVersion: RESOLVED_PLAN_SCHEMA_VERSION,
    component: entry.name,
    parts: pseudoParts.length > 0 ? [...entry.parts, ...pseudoParts] : entry.parts,
    variantAxes: axes.map((a) => ({ prop: a.prop, values: a.values, default: a.default })),
    variantMatrix,
    gridLabels,
    baseGeometry,
    ...(Object.keys(partBindings).length > 0 ? { partBindings } : {}),
    ...(Object.keys(refusedPseudoParts).length > 0 ? { refusedPseudoParts } : {}),
    ...(Object.keys(refusedNegations).length > 0 ? { refusedNegations } : {}),
    ...(Object.keys(refusedMargins).length > 0 ? { refusedMargins } : {}),
    ...(Object.keys(radiusFallbacks).length > 0 ? { radiusFallbacks } : {}),
  };
}
