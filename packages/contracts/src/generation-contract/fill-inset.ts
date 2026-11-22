/**
 * An item that fills its padded track: `calc(var(--whole) - 2 * var(--inset))` as FILL.
 *
 * Tabs' segment tab and the joined ToggleGroup's items are sized `calc(<control height> - 2 *
 * <control inset>)` inside a track that is exactly `<control height>` tall and pads that axis by
 * `<control inset>` on both sides. The CSS intent is "fill the track", and Figma says it directly:
 * the child stretches across the parent's cross axis (`layoutSizing = "FILL"`) and lands on the
 * same box, with no computed height to go stale.
 *
 * The rewrite is made only when it is exact: the parent lays out in flow, the child's size is that
 * calc, the parent's own size on that axis is bound to the calc's `whole`, and the parent pads that
 * axis with the calc's `inset` on both sides (so `count` is 2). Anything else keeps the computed
 * px the resolver produced, as before. The `insetOf` intermediate never reaches a compiled plan.
 */
import type {
  ComposedChildOverrideCell,
  ResolvedComponentPlan,
  ResolvedDimension,
  ResolvedPlanGeometry,
} from "../resolved-plan/types";
import { anyGeometry, createLayoutPass } from "./layout-pass";
import type { FigmaGenerationContract, GenerationContractAnatomyNode } from "./types";

type Axis = "width" | "height";

/** Whether a dimension is a literal derived from `calc(whole - 2 * inset)`. */
const hasInset = (dimension: ResolvedDimension | undefined): boolean =>
  dimension?.kind === "literal" && dimension.insetOf !== undefined;

/** The padding variable a parent applies on BOTH sides of `axis`, or `undefined` when the sides differ. */
function symmetricPadding(geometry: ResolvedPlanGeometry, axis: Axis): string | undefined {
  if (axis === "height") {
    const { paddingBlock, paddingTop, paddingBottom } = geometry;
    return (
      paddingBlock ??
      (paddingTop !== undefined && paddingTop === paddingBottom ? paddingTop : undefined)
    );
  }
  const { paddingInline, paddingLeft, paddingRight } = geometry;
  return (
    paddingInline ??
    (paddingLeft !== undefined && paddingLeft === paddingRight ? paddingLeft : undefined)
  );
}

/** The axis a child of a flow parent fills by stretching (the parent's cross axis), or `undefined`. */
function crossAxis(layout: string): Axis | undefined {
  if (layout === "horizontal") return "height";
  if (layout === "vertical") return "width";
  return undefined;
}

/** Whether `child`'s inset calc is exactly the parent's padded box on `axis`. */
function fillsParent(
  parent: ResolvedPlanGeometry,
  child: ResolvedDimension | undefined,
  axis: Axis,
): boolean {
  if (child?.kind !== "literal" || !child.insetOf) return false;
  const own = parent[axis];
  return (
    own?.kind === "variable" &&
    own.variable === child.insetOf.whole &&
    child.insetOf.count === 2 &&
    symmetricPadding(parent, axis) === child.insetOf.inset
  );
}

/** Drops the inset bookkeeping from a dimension, leaving a plain literal. */
function stripInset(dimension: ResolvedDimension | undefined): ResolvedDimension | undefined {
  if (dimension?.kind !== "literal" || dimension.insetOf === undefined) return dimension;
  return { kind: "literal", px: dimension.px };
}

/** Finds the anatomy node that directly contains a part. */
function parentOf(
  root: GenerationContractAnatomyNode | undefined,
  part: string,
): GenerationContractAnatomyNode | undefined {
  if (!root) return undefined;
  for (const child of root.children ?? []) {
    if (child.part === part) return root;
    const found = parentOf(child, part);
    if (found) return found;
  }
  return undefined;
}

/**
 * A composed child's per-cell instance heights, with each `calc(<whole> - 2 * <inset>)` that is
 * exactly its parent's padded track replaced by `{ kind: "fill" }` (the instance stretches), and
 * the intermediate dropped from every other height (the computed px stays). `slotPart` is the
 * anatomy part that hosts the composed child; `plan` is the parent's final plan.
 */
export function fillComposedChildInsets(
  contract: FigmaGenerationContract,
  plan: ResolvedComponentPlan,
  slotPart: string,
  cells: ComposedChildOverrideCell[],
): ComposedChildOverrideCell[] {
  const pass = createLayoutPass(contract, plan);
  const parent = parentOf(contract.anatomy, slotPart);
  return cells.map((cell) => {
    const index = pass.variantMatrix.findIndex((candidate) =>
      Object.entries(cell.key).every(([axis, value]) => candidate.key[axis] === value),
    );
    // An instance height is a vertical size: it fills only across a horizontal parent.
    const fillsHeight =
      parent !== undefined && index >= 0 && crossAxis(pass.layoutOf(parent, index)) === "height";
    const parentGeometry = parent && index >= 0 ? pass.read(parent.part, index) : undefined;
    const positions = Object.fromEntries(
      Object.entries(cell.positions).map(([position, binding]) => {
        const height = binding.height;
        if (!height || height.kind !== "literal" || !height.insetOf) return [position, binding];
        const fills =
          fillsHeight &&
          parentGeometry !== undefined &&
          fillsParent(parentGeometry, height, "height");
        const next = fills
          ? { kind: "fill" as const }
          : { kind: "literal" as const, px: height.px };
        return [position, { ...binding, height: next }];
      }),
    );
    return { ...cell, positions };
  });
}

/**
 * Rewrites a child sized `calc(whole - 2 * inset)` to fill its parent when the parent is exactly
 * that size and padding; otherwise keeps the computed size.
 */
export function mapInsetCalcToFill(
  contract: FigmaGenerationContract,
  plan: ResolvedComponentPlan,
): ResolvedComponentPlan {
  const partHasInset = (geometry: ResolvedPlanGeometry) =>
    hasInset(geometry.width) || hasInset(geometry.height);
  if (!anyGeometry(plan, partHasInset)) return plan;

  const pass = createLayoutPass(contract, plan);
  plan.variantMatrix.forEach((_cell, index) => {
    pass.edges(index, (parent, child, removedFromFlow) => {
      if (removedFromFlow) return;
      const axis = crossAxis(pass.layoutOf(parent, index));
      if (!axis) return;
      const geometry = pass.own(child.part, index);
      if (!geometry || !hasInset(geometry[axis])) return;
      if (fillsParent(pass.read(parent.part, index), geometry[axis], axis)) {
        geometry[axis] = { kind: "fill" };
      }
    });
  });

  // Whatever did not become FILL keeps its computed px, without the intermediate.
  const strip = (geometry: ResolvedPlanGeometry | undefined) => {
    if (!geometry) return;
    for (const axis of ["width", "height"] as const) {
      const next = stripInset(geometry[axis]);
      if (next !== geometry[axis] && next) geometry[axis] = next;
    }
  };
  strip(pass.baseGeometry);
  for (const cell of pass.variantMatrix) strip(cell.geometry);
  for (const cells of Object.values(pass.partBindings))
    for (const cell of cells) strip(cell.geometry);
  pass.changed = true;
  return pass.result();
}
