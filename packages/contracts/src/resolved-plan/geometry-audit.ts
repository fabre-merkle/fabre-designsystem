import type { ResolvedComponentPlan, ResolvedDimension, ResolvedPlanGeometry } from "./types";

export type UnsizedDimension = "width" | "height";

/** One node the plan leaves without a determined box, as `component → part`. */
export interface UnsizedNode {
  /** Component display name, e.g. `"Select"`. */
  component: string;
  /** The node's `data-ui` part name, e.g. `"select-separator"`. */
  part: string;
  /** The dimensions Figma would default to 100 for. */
  missing: UnsizedDimension[];
}

export interface AuditResolvedPlanGeometryOptions {
  rootPart: string;
  /**
   * Parts that render text content and therefore hug it. The plan carries no
   * slot/child inventory, so a caller that knows the anatomy (a generation
   * contract) declares them; without it, resolved typography is the only signal.
   */
  textParts?: readonly string[];
  declaredDimensions?: Readonly<Record<string, readonly UnsizedDimension[]>>;
  /**
   * Parts whose direct parent is a real auto-layout frame. A CSS `100%` only
   * translates to Figma `FILL` for these children; roots and overlay children
   * reject `layoutSizing*` at materialization time.
   */
  autoLayoutParentParts?: readonly string[];
  parentLayoutForCell?: (
    part: string,
    cellKey: Readonly<Record<string, string>>,
  ) => ParentAutoLayout | undefined;
  removeFromFlowStretchForCell?: (
    part: string,
    cellKey: Readonly<Record<string, string>>,
  ) => { main?: boolean; cross?: boolean } | undefined;
}

/**
 * The three shapes a node's parent auto-layout can resolve to, at the
 * CONTRACT level (`GenerationContractLayout`, never Figma's own runtime
 * `layoutMode` enum) — kept as a local literal union rather than importing
 * that type, so this pure module stays free of a `generation-contract`
 * dependency (that package already depends on `resolved-plan`; the reverse
 * would be circular).
 */
export type ParentAutoLayout = "horizontal" | "vertical" | "overlay";

export function mainAxisDimension(
  parentLayout: ParentAutoLayout | undefined,
): UnsizedDimension | undefined {
  if (parentLayout === "horizontal") return "width";
  if (parentLayout === "vertical") return "height";
  return undefined;
}

/** Geometry keys whose presence means the node renders text, and so hugs it. */
const TEXT_GEOMETRY_KEYS = [
  "textStyle",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
] as const satisfies ReadonlyArray<keyof ResolvedPlanGeometry>;

function hugsContent(geometry: ResolvedPlanGeometry): boolean {
  return (
    TEXT_GEOMETRY_KEYS.some((key) => geometry[key] !== undefined) ||
    geometry.paddingInline !== undefined ||
    geometry.paddingBlock !== undefined ||
    geometry.paddingLeft !== undefined ||
    geometry.paddingRight !== undefined ||
    geometry.paddingTop !== undefined ||
    geometry.paddingBottom !== undefined
  );
}

export function unsizedDimensions(
  geometry: ResolvedPlanGeometry,
  hasAutoLayoutParent = true,
  mainAxisFillDimension?: UnsizedDimension,
): UnsizedDimension[] {
  if (hugsContent(geometry)) return [];
  const fillAxis = geometry.growsOnMainAxis ? mainAxisFillDimension : undefined;
  const missing: UnsizedDimension[] = [];
  if (fillAxis !== "width" && !determinesBox(geometry.width, hasAutoLayoutParent)) {
    missing.push("width");
  }
  if (fillAxis !== "height" && !determinesBox(geometry.height, hasAutoLayoutParent)) {
    missing.push("height");
  }
  return missing;
}

function determinesBox(
  dimension: ResolvedDimension | undefined,
  hasAutoLayoutParent: boolean,
): boolean {
  if (dimension === undefined) return false;
  return (
    dimension.kind === "variable" ||
    dimension.kind === "literal" ||
    dimension.kind === "runtime" ||
    (dimension.kind === "fill" && hasAutoLayoutParent)
  );
}

interface AuditCell {
  key: Readonly<Record<string, string>>;
  geometry: ResolvedPlanGeometry;
}

function auditCells(
  cells: readonly AuditCell[],
  component: string,
  part: string,
  options: AuditResolvedPlanGeometryOptions,
): UnsizedNode | undefined {
  if (options.textParts?.includes(part)) return undefined;
  const staticallyDeclared = new Set<UnsizedDimension>(options.declaredDimensions?.[part] ?? []);
  // A node is only as sized as its worst cell — one unsized variant is one
  // 100×100 component in the generated set.
  const missing = new Set<UnsizedDimension>();
  const hasAutoLayoutParent = options.autoLayoutParentParts?.includes(part) ?? false;
  for (const { key, geometry } of cells) {
    const parentLayout = options.parentLayoutForCell?.(part, key);
    const mainAxisFillDimension = mainAxisDimension(parentLayout);
    const crossAxisFillDimension: UnsizedDimension | undefined =
      mainAxisFillDimension === "width"
        ? "height"
        : mainAxisFillDimension === "height"
          ? "width"
          : undefined;
    const stretch = options.removeFromFlowStretchForCell?.(part, key);
    const declared = new Set(staticallyDeclared);
    if (stretch?.main && mainAxisFillDimension) declared.add(mainAxisFillDimension);
    if (stretch?.cross && crossAxisFillDimension) declared.add(crossAxisFillDimension);
    for (const dimension of unsizedDimensions(
      geometry,
      hasAutoLayoutParent,
      mainAxisFillDimension,
    )) {
      if (!declared.has(dimension)) missing.add(dimension);
    }
  }
  if (missing.size === 0) return undefined;
  return {
    component,
    part,
    missing: (["width", "height"] as const).filter((dimension) => missing.has(dimension)),
  };
}

/**
 * PURE. `(plan) → every node whose box the plan doesn't determine`, in a stable
 * order (root first, then sub-parts in `parts` order). Same plan in →
 * byte-identical list out.
 */
export function auditResolvedPlanGeometry(
  plan: ResolvedComponentPlan,
  options: AuditResolvedPlanGeometryOptions,
): UnsizedNode[] {
  const unsized: UnsizedNode[] = [];

  const rootCells: AuditCell[] = plan.variantMatrix.map((cell) => ({
    key: cell.key,
    geometry: { ...plan.baseGeometry, ...(cell.geometry ?? {}) },
  }));
  // An empty matrix would otherwise audit nothing and report the root as sized —
  // silence is the one answer this gate must never give.
  const root = auditCells(
    rootCells.length > 0 ? rootCells : [{ key: {}, geometry: plan.baseGeometry }],
    plan.component,
    options.rootPart,
    options,
  );
  if (root) unsized.push(root);

  for (const part of plan.parts) {
    if (part === options.rootPart) continue;
    // No `partBindings` entry means the part resolved nothing at all — audited as
    // one node with empty geometry, not skipped.
    const cells: AuditCell[] = plan.partBindings?.[part]?.map((cell) => ({
      key: cell.key,
      geometry: cell.geometry ?? {},
    })) ?? [{ key: {}, geometry: {} }];
    const node = auditCells(cells, plan.component, part, options);
    if (node) unsized.push(node);
  }

  return unsized;
}
