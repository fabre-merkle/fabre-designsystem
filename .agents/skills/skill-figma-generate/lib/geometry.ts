/**
 * Component geometry — the PURE decisions about each variant cell's box
 *, taken from the compiled V2 artifact and nothing else.
 *
 * Bindings come from component CSS; INTRINSIC geometry (sizes, alignment) does
 * not, so the artifact declares it and CSS-unsized dimensions are REFUSED and
 * reported, never guessed. This module is the skill's mirror of the Figma
 * plugin walker's sizing decisions (`axisSizingPlan` / `nodeSizingPlan` /
 * `materializeVariant`): the same
 * artifact must yield the same box on both sides, so the parity gate can compare
 * them node for node.
 *
 * Standalone by construction: it imports only the skill's own `artifact.ts`
 * types and never `@focus/figma-generators`. PURE: no Figma I/O, no
 * `Date`/random. `emit.ts` carries out the decisions via the Plugin API.
 *
 * The five dimension kinds the artifact can carry, and what each becomes:
 *
 *   - `variable`    → bind `width`/`height` to the Figma variable, axis FIXED
 *   - `fill`        → `layoutSizing* = "FILL"` (auto-layout children only)
 *   - `literal`     → `resize()`, axis FIXED (also how a contract's declared
 *                     `literalGeometry` reaches the root)
 *   - `hug`         → NO instruction: the auto-layout frame already hugs. This is
 *                     both CSS `auto`/`fit-content` and a reviewed declaration for
 *                     a size the browser measures at runtime — legitimately unsized, not a refusal
 *   - `unsupported` → REFUSED and reported (Figma has no proportional sizing)
 *
 * A dimension kind this skill does not recognise is refused too. The plugin
 * leaves such a node hugging silently; the skill reports it instead, because a
 * shape the resolved-plan schema version gate should have rejected is exactly
 * the "plausible-wrong value" that must never be guessed.
 */
import type { ArtifactComponent, ResolvedCell, ResolvedDimension, ResolvedGeometry } from "./artifact";
import { VIEWPORT_CONTEXT_AXIS_PROP, VIEWPORT_CONTEXT_COMPONENT, viewportFramePlan } from "./viewport";

/** What to do to ONE axis. `hug` never appears: it is the absence of an instruction. */
export type AxisSizing =
  | { mode: "bind"; variable: string }
  | { mode: "fill" }
  | { mode: "fixed"; px: number }
  | { mode: "refused"; value: string }
  /**
   * a size the CSS reads from a runtime custom property, turned into a
   * fraction of the parent's length on that axis by the contract's declared runtime value for this
   * cell. Only an anatomy node gets one (`anatomy.ts`); it is applied once the parent's box is final.
   */
  | { mode: "runtime"; fraction: number; property: string };

export interface NodeSizing {
  width?: AxisSizing;
  height?: AxisSizing;
}

export type CellLayoutMode = "HORIZONTAL" | "VERTICAL" | "NONE";
export type PrimaryAxisAlign = "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
export type CounterAxisAlign = "MIN" | "CENTER" | "MAX";

/** Declared literal root dimensions (`contract.literalGeometry`), in px. */
export interface LiteralSize {
  width?: number;
  height?: number;
}

/** The complete box decision for one variant cell's root component. */
export interface CellGeometryPlan {
  /** Variant key — joins this entry to `variantMatrix[i].key`. */
  key: Record<string, string>;
  /** Variant name; also the label every refusal for this cell is reported under. */
  label: string;
  /**
   * `NONE` is the contract's authored `overlay` layout (Checkbox, Radio, Switch,
   * ScrollArea, NavigationMenu roots): children are positioned, not flowed, and
   * the frame must not clip them.
   */
  layoutMode: CellLayoutMode;
  primaryAxisAlignItems: PrimaryAxisAlign;
  counterAxisAlignItems: CounterAxisAlign;
  /** Root `literalGeometry` for this cell — applied BEFORE `sizing`, which then wins per axis. */
  literalSize?: LiteralSize;
  sizing: NodeSizing;
  /**
   * A `context=component` cell whose CSS caps the popup width (`min(…, 480px)`): the bare popup
   * hugs its content up to this `maxWidth`, so long copy wraps at the CSS width.
   */
  maxWidthPx?: number;
  /** `aspect-ratio` — a POST-sizing step that reshapes whatever box sizing produced. */
  aspectRatio?: number;
  /** `"<label> <axis>: <value>"` for every axis the artifact marks `unsupported`. */
  refusals: string[];
}

/**
 * PURE. `(resolved dimension) → what to do to that axis`, or `undefined` for "no
 * instruction" (nothing declared, or `hug`).
 */
export function axisSizing(dimension: ResolvedDimension | undefined): AxisSizing | undefined {
  if (!dimension) return undefined;
  switch (dimension.kind) {
    case "variable":
      return { mode: "bind", variable: dimension.variable };
    case "fill":
      return { mode: "fill" };
    case "literal":
      return { mode: "fixed", px: dimension.px };
    case "unsupported":
      return { mode: "refused", value: dimension.value };
    case "runtime":
      // A size the CSS reads from a runtime custom property: refused, like the plugin
      // (which only turns it into a size when the contract declares a value for it).
      return { mode: "refused", value: `var(${dimension.property})` };
    case "hug":
      return undefined; // leave auto-layout alone
    default:
      return { mode: "refused", value: `unrecognised dimension kind "${String((dimension as { kind: unknown }).kind)}"` };
  }
}

/**
 * PURE. A root's sizing decision. The root has no auto-layout parent, so
 * `growsOnMainAxis` (a parent-relative intent) never applies here — same as the
 * plugin's `nodeSizingPlan(geometry)` for a variant root.
 */
export function nodeSizing(geometry: ResolvedGeometry | undefined): NodeSizing {
  const width = axisSizing(geometry?.width);
  const height = axisSizing(geometry?.height);
  return { ...(width ? { width } : {}), ...(height ? { height } : {}) };
}

export function keyMatches(key: Record<string, string>, expected: Record<string, string | string[]> | undefined): boolean {
  return Object.entries(expected ?? {}).every(([prop, value]) => (Array.isArray(value) ? value.includes(key[prop]) : key[prop] === value));
}

/** `byAxis.values[key[axis]] ?? base` — the contract's axis-conditional field resolution. */
export function resolveByAxis<T>(
  byAxis: { axis: string; values: Partial<Record<string, T>> } | undefined,
  base: T | undefined,
  key: Record<string, string>,
): T | undefined {
  if (!byAxis) return base;
  return byAxis.values[key[byAxis.axis]] ?? base;
}

type AnatomyLayout = "horizontal" | "vertical" | "overlay";

function isLayout(value: unknown): value is AnatomyLayout {
  return value === "horizontal" || value === "vertical" || value === "overlay";
}

/** The root anatomy node's authored `layout` for this cell (after `layoutByAxis`), if the node applies. */
function rootAnatomyLayout(component: ArtifactComponent, key: Record<string, string>): AnatomyLayout | undefined {
  const root = component.contract.anatomy;
  if (!root) return undefined;
  const layout = resolveByAxis(root.layoutByAxis as never, root.layout as never, key);
  return isLayout(layout) ? layout : undefined;
}

/** Whether the anatomy root applies to this cell (`when`/`unless`). The plugin builds no anatomy otherwise. */
function rootAnatomyApplies(component: ArtifactComponent, key: Record<string, string>): boolean {
  const root = component.contract.anatomy;
  if (!root) return false;
  const when = root.when as Record<string, string | string[]> | undefined;
  const unless = root.unless as Record<string, string | string[]> | undefined;
  return keyMatches(key, when) && !(unless && keyMatches(key, unless));
}

function literalSizeFor(component: ArtifactComponent, key: Record<string, string>): LiteralSize | undefined {
  // The plugin only reads `literalGeometry` through the anatomy tree, for the
  // anatomy ROOT's own part.
  if (!rootAnatomyApplies(component, key)) return undefined;
  const rootPart = component.contract.anatomy?.part;
  const literal = component.contract.literalGeometry?.find(
    (candidate) => candidate.part === rootPart && keyMatches(key, candidate.when as Record<string, string | string[]> | undefined),
  );
  if (!literal) return undefined;
  const width = typeof literal.width === "number" ? literal.width : undefined;
  const height = typeof literal.height === "number" ? literal.height : undefined;
  if (width === undefined && height === undefined) return undefined;
  return { ...(width !== undefined ? { width } : {}), ...(height !== undefined ? { height } : {}) };
}

/**
 * PURE. The box decision for one variant cell: layout direction, alignment,
 * declared literal size, per-axis sizing and aspect ratio — mirroring the
 * plugin's `materializeVariant`:
 *
 *   - direction: the anatomy root's authored `layout` wins (`overlay` → `NONE`),
 *     else the CSS-derived `layoutMode`, else `HORIZONTAL` (CSS's own default
 *     `flex-direction: row`)
 *   - alignment: the CSS-derived `primaryAxisAlignItems`/`counterAxisAlignItems`,
 *     else `MIN` — Figma's own default, NOT a hardcoded `CENTER`
 */
export function cellGeometryPlan(component: ArtifactComponent, cell: ResolvedCell, cellIndex = component.resolvedPlan.variantMatrix.indexOf(cell)): CellGeometryPlan {
  const geometry: ResolvedGeometry = { ...component.resolvedPlan.baseGeometry, ...cell.geometry };
  const authored = rootAnatomyApplies(component, cell.key) ? rootAnatomyLayout(component, cell.key) : undefined;
  const layoutMode: CellLayoutMode = authored
    ? authored === "overlay"
      ? "NONE"
      : authored === "vertical"
        ? "VERTICAL"
        : "HORIZONTAL"
    : (geometry.layoutMode ?? "HORIZONTAL");
  const sizing = nodeSizing(geometry);
  // Window-placed components, as the plugin's `buildComponentSetNodePlan`. The popup is the
  // viewport frame's child, so a frame-relative FILL is legal: a cell whose own CSS sets no width
  // (drawer docked top/bottom; toast, whose width lives on its viewport container) takes it from
  // the frame plan. A `context=component` cell is the bare popup: the frame-relative `fill` the
  // build computed has no parent there, so the popup hugs.
  const viewport = cellIndex >= 0 ? viewportFramePlan(component, cellIndex) : undefined;
  if (viewport && viewport.popupWidth.mode !== "hug" && !sizing.width) sizing.width = { mode: "fill" };
  let maxWidthPx: number | undefined;
  if (
    !viewport &&
    component.contract.viewport?.popupWidth &&
    cell.key[VIEWPORT_CONTEXT_AXIS_PROP] === VIEWPORT_CONTEXT_COMPONENT &&
    true
  ) {
    if (sizing.width?.mode === "fill") delete sizing.width;
    const popupWidth = component.contract.viewport.popupWidth;
    // The same rule the viewport frame uses: the build rewrote the width to `fill` on the cells the
    // cap applies to, and a non-root `placementPart` (toast) carries it for every cell.
    if (geometry.width?.kind === "fill" || component.contract.viewport.placementPart !== undefined) {
      maxWidthPx = popupWidth.maxWidthPx;
    }
  }
  const literalSize = literalSizeFor(component, cell.key);
  const refusals = (["width", "height"] as const).flatMap((axis) => {
    const decision = sizing[axis];
    return decision?.mode === "refused" ? [`${cell.label} ${axis}: ${decision.value}`] : [];
  });
  return {
    key: cell.key,
    label: cell.label,
    layoutMode,
    primaryAxisAlignItems: geometry.primaryAxisAlignItems ?? "MIN",
    counterAxisAlignItems: geometry.counterAxisAlignItems ?? "MIN",
    ...(literalSize ? { literalSize } : {}),
    sizing,
    ...(maxWidthPx !== undefined ? { maxWidthPx } : {}),
    ...(geometry.aspectRatio ? { aspectRatio: geometry.aspectRatio } : {}),
    refusals,
  };
}

/** PURE. One `CellGeometryPlan` per variant cell, in matrix order. */
export function componentGeometryPlans(component: ArtifactComponent): CellGeometryPlan[] {
  return component.resolvedPlan.variantMatrix.map((cell, index) => cellGeometryPlan(component, cell, index));
}

/** Every distinct size variable the plan binds — merged into the preflight's token coverage check. */
export function sizeVariablesInGeometry(plans: readonly CellGeometryPlan[]): string[] {
  const out: string[] = [];
  for (const plan of plans) {
    for (const axis of [plan.sizing.width, plan.sizing.height]) {
      if (axis?.mode === "bind" && !out.includes(axis.variable)) out.push(axis.variable);
    }
  }
  return out;
}
