import type { ComponentRegistryAxis } from "../registry";
import { parseComponentCss } from "../registry/css-parser";
import {
  cssVarToFigmaVariableName,
  isProjectTokenName,
  normalizeVariableName,
} from "../registry/resolver";
import type { ResolvedComponentPlan, ResolvedPlanGeometry } from "../resolved-plan/types";
import type {
  FigmaGenerationContract,
  GenerationContractAnatomyNode,
  GenerationContractViewport,
  ViewportEdge,
  ViewportPlacement,
  ViewportPopupWidth,
} from "./types";

export const VIEWPORT_FRAME_WIDTH_VARIABLE = "web/breakpoint/view";

export const VIEWPORT_CONTEXT_AXIS_PROP = "context";
export const VIEWPORT_CONTEXT_VIEWPORT = "viewport";
export const VIEWPORT_CONTEXT_COMPONENT = "component";

/**
 * The one shape a viewport component's `context` axis may take. Design-only (no DOM attribute
 * distinguishes the two), so neither value adds a CSS constraint and both resolve identical
 * bindings; only the walker treats them differently.
 */
export const VIEWPORT_CONTEXT_AXIS: ComponentRegistryAxis = {
  prop: VIEWPORT_CONTEXT_AXIS_PROP,
  values: [VIEWPORT_CONTEXT_VIEWPORT, VIEWPORT_CONTEXT_COMPONENT],
  default: VIEWPORT_CONTEXT_VIEWPORT,
  attribute: "data-context",
  valueSelectors: { [VIEWPORT_CONTEXT_VIEWPORT]: null, [VIEWPORT_CONTEXT_COMPONENT]: null },
};

export const VIEWPORT_PLACEMENTS: ReadonlySet<ViewportPlacement> = new Set([
  "center",
  "docked",
  "corner",
]);

export const VIEWPORT_EDGES: ReadonlySet<ViewportEdge> = new Set([
  "top",
  "right",
  "bottom",
  "left",
]);

/** The two edges a corner sits on, e.g. `bottom-right` → `[bottom, right]`. */
export function cornerEdges(corner: string): [ViewportEdge, ViewportEdge] | undefined {
  const [block, inline] = corner.split("-");
  if ((block !== "top" && block !== "bottom") || (inline !== "left" && inline !== "right")) {
    return undefined;
  }
  return [block, inline];
}

/** Fields the compiler writes; an authored contract that sets one is rejected. */
const COMPUTED_VIEWPORT_FIELDS = [
  "frameWidthVariable",
  "framePaddingBlock",
  "popupWidth",
  "cornerOffsets",
] as const;

const POPUP_WIDTH_RE =
  /^min\(\s*calc\(\s*100vw\s*-\s*var\(\s*(--[a-zA-Z0-9-]+)\s*\)\s*\)\s*,\s*(\d+(?:\.\d+)?)px\s*\)$/;
const POPUP_MAX_HEIGHT_RE = /^calc\(\s*100vh\s*-\s*var\(\s*(--[a-zA-Z0-9-]+)\s*\)\s*\)$/;

/**
 * PURE. `min(calc(100vw - var(--m)), <cap>px)` → its margin token and cap, or `undefined` for any
 * other shape (which then stays a reported refusal — never approximated).
 */
export function parseViewportPopupWidthCss(
  value: string,
): { marginVar: string; maxWidthPx: number } | undefined {
  const match = POPUP_WIDTH_RE.exec(value.trim().replace(/\s+/g, " "));
  if (!match) return undefined;
  return { marginVar: match[1], maxWidthPx: Number(match[2]) };
}

/**
 * Every `property` value the part's rules declare — the unconditional rule AND its attribute-
 * conditioned variants (`[data-ui="p"][data-side="up"]`, `:not([data-side])`), outside `@media`.
 * Drawer's `max-height` lives on its per-side rules, not on one base rule.
 */
function partDeclarations(cssSource: string, part: string, property: string): string[] {
  const selector = new RegExp(
    `^\\[data-ui="${part}"\\](?:\\[[^\\]]+\\]|:not\\(\\[[^\\]]+\\]\\))*$`,
  );
  const values: string[] = [];
  for (const rule of parseComponentCss(cssSource)) {
    if (rule.media.length > 0) continue;
    if (!rule.selectors.some((candidate) => selector.test(candidate))) continue;
    for (const declaration of rule.declarations) {
      if (declaration.property === property) values.push(declaration.value);
    }
  }
  return values;
}

function anatomyParts(node: GenerationContractAnatomyNode | undefined, out = new Set<string>()) {
  if (!node) return out;
  out.add(node.part);
  for (const child of node.children ?? []) anatomyParts(child, out);
  return out;
}

function sameAxis(a: ComponentRegistryAxis, b: ComponentRegistryAxis): boolean {
  return (
    a.prop === b.prop &&
    a.default === b.default &&
    a.attribute === b.attribute &&
    JSON.stringify(a.values) === JSON.stringify(b.values) &&
    JSON.stringify(a.valueSelectors ?? {}) === JSON.stringify(b.valueSelectors ?? {})
  );
}

/** The placement-specific declarations (`dock`, `corner`, `placementPart`) a contract must carry. */
function assertAuthoredPlacement(
  contract: FigmaGenerationContract,
  viewport: NonNullable<FigmaGenerationContract["viewport"]>,
): void {
  const slug = contract.slug;
  if (viewport.placement === "docked") {
    const dock = viewport.dock;
    const axis = dock && contract.axes.find((candidate) => candidate.prop === dock.axis);
    if (!dock || !axis) {
      throw new Error(
        `"${slug}" viewport.placement "docked" needs viewport.dock naming a declared axis ` +
          "(its value picks the edge the popup docks to).",
      );
    }
    const edgeKeys = Object.keys(dock.edges).sort();
    if (
      JSON.stringify(edgeKeys) !== JSON.stringify([...axis.values].sort()) ||
      !Object.values(dock.edges).every((edge) => VIEWPORT_EDGES.has(edge))
    ) {
      throw new Error(
        `"${slug}" viewport.dock.edges must map every value of the "${dock.axis}" axis ` +
          `(${axis.values.join(", ")}) to one of: ${[...VIEWPORT_EDGES].join(", ")}.`,
      );
    }
  } else if (viewport.dock) {
    throw new Error(`"${slug}" viewport.dock only applies to placement "docked".`);
  }
  if (viewport.placement === "corner") {
    if (!viewport.corner || !cornerEdges(viewport.corner)) {
      throw new Error(
        `"${slug}" viewport.placement "corner" needs viewport.corner: top-left | top-right | ` +
          "bottom-left | bottom-right.",
      );
    }
  } else if (viewport.corner) {
    throw new Error(`"${slug}" viewport.corner only applies to placement "corner".`);
  }
  // The placement part is either a materialized part or an omitted one: toast-viewport is the
  // stacking container the frame stands in for, so it is omitted from the anatomy by design.
  if (
    viewport.placementPart !== undefined &&
    !contract.parts.includes(viewport.placementPart) &&
    !(viewport.placementPart in (contract.omittedParts ?? {}))
  ) {
    throw new Error(
      `"${slug}" viewport.placementPart "${viewport.placementPart}" must be declared in parts or omittedParts.`,
    );
  }
}

/**
 * Author-time shape checks that need no resolved plan — shared by the compiler (before resolution,
 * so a malformed declaration fails with its own message rather than a downstream one).
 */
export function assertAuthoredViewport(contract: FigmaGenerationContract): void {
  const contextAxis = contract.axes.find((axis) => axis.prop === VIEWPORT_CONTEXT_AXIS_PROP);
  const viewport = contract.viewport;
  if (!viewport) {
    if (contextAxis) {
      throw new Error(
        `"${contract.slug}" declares a "${VIEWPORT_CONTEXT_AXIS_PROP}" axis without a viewport — ` +
          "the context axis only exists to switch a viewport stand-in frame on and off.",
      );
    }
    return;
  }
  for (const field of COMPUTED_VIEWPORT_FIELDS) {
    if (viewport[field] !== undefined) {
      throw new Error(
        `"${contract.slug}" viewport.${field} is computed when the contract is built from the ` +
          "component's own CSS — remove it from the authored contract.",
      );
    }
  }
  if (!VIEWPORT_PLACEMENTS.has(viewport.placement)) {
    throw new Error(
      `"${contract.slug}" viewport.placement "${viewport.placement}" is not supported — ` +
        `expected one of: ${[...VIEWPORT_PLACEMENTS].join(", ")}.`,
    );
  }
  assertAuthoredPlacement(contract, viewport);
  if (!viewport.reason?.trim()) {
    throw new Error(`"${contract.slug}" viewport.reason must be non-empty reviewed prose.`);
  }
  if (!contextAxis || !sameAxis(contextAxis, VIEWPORT_CONTEXT_AXIS)) {
    throw new Error(
      `"${contract.slug}" declares a viewport, so it must declare the context axis exactly as ` +
        `VIEWPORT_CONTEXT_AXIS: ${JSON.stringify(VIEWPORT_CONTEXT_AXIS)}.`,
    );
  }
  if (contract.anatomy?.positionAlongMain || contract.anatomy?.positionAlongMainByAxis) {
    throw new Error(
      `"${contract.slug}" declares a viewport, so its root placement is viewport.placement — ` +
        "remove the root anatomy's positionAlongMain.",
    );
  }
  const backdrop = viewport.backdropPart;
  if (backdrop !== undefined) {
    if (!contract.parts.includes(backdrop)) {
      throw new Error(
        `"${contract.slug}" viewport.backdropPart "${backdrop}" must be declared in parts.`,
      );
    }
    if (anatomyParts(contract.anatomy).has(backdrop)) {
      throw new Error(
        `"${contract.slug}" viewport.backdropPart "${backdrop}" must not appear in the anatomy — ` +
          "the frame, not the popup, renders it.",
      );
    }
  }
}

/**
 * PURE. Rewrite the popup root's refused viewport width to `fill` wherever it is exactly the CSS
 * text `popupWidth` was computed from. Shared by the compiler and the coverage gate, so both agree
 * on which refusals the frame resolves.
 */
export function applyViewportPopupWidth(
  plan: ResolvedComponentPlan,
  popupWidth: ViewportPopupWidth | undefined,
): ResolvedComponentPlan {
  if (!popupWidth) return plan;
  const rewrite = <T extends ResolvedPlanGeometry | undefined>(geometry: T): T => {
    const width = geometry?.width;
    if (width?.kind !== "unsupported" || width.value !== popupWidth.source) return geometry;
    return { ...geometry, width: { kind: "fill" } } as T;
  };
  return {
    ...plan,
    baseGeometry: rewrite(plan.baseGeometry),
    variantMatrix: plan.variantMatrix.map((cell) =>
      cell.geometry ? { ...cell, geometry: rewrite(cell.geometry) } : cell,
    ),
    // A `placementPart` that is not the root (toast-viewport) carries the CSS the width came from.
    ...(plan.partBindings
      ? {
          partBindings: Object.fromEntries(
            Object.entries(plan.partBindings).map(([part, cells]) => [
              part,
              cells.map((cell) =>
                cell.geometry ? { ...cell, geometry: rewrite(cell.geometry) } : cell,
              ),
            ]),
          ),
        }
      : {}),
  };
}

/** Every refused `width` the plan carries for `part` (root: base + per-cell; else part cells). */
function refusedWidthsOf(plan: ResolvedComponentPlan, part: string, isRoot: boolean): string[] {
  const geometries: Array<ResolvedPlanGeometry | undefined> = isRoot
    ? [plan.baseGeometry, ...plan.variantMatrix.map((cell) => cell.geometry)]
    : (plan.partBindings?.[part] ?? []).map((cell) => cell.geometry);
  const values = new Set<string>();
  for (const geometry of geometries) {
    if (geometry?.width?.kind === "unsupported") values.add(geometry.width.value);
  }
  return [...values];
}

/**
 * Compile-time half of the viewport: verify the declaration against the resolved plan, compute the
 * frame's fields from the component's own CSS, and apply the popup width to the plan.
 */
export function compileViewport(args: {
  contract: FigmaGenerationContract;
  plan: ResolvedComponentPlan;
  /**
   * The plan BEFORE undeclared/omitted parts were pruned. A `placementPart` that is omitted
   * (toast-viewport) only exists here. Defaults to `plan`.
   */
  sourcePlan?: ResolvedComponentPlan;
  cssSource: string;
}): { viewport: GenerationContractViewport | undefined; plan: ResolvedComponentPlan } {
  const { contract, plan, cssSource } = args;
  const sourcePlan = args.sourcePlan ?? plan;
  const viewport = contract.viewport;
  if (!viewport) return { viewport: undefined, plan };
  if (!isProjectTokenName(VIEWPORT_FRAME_WIDTH_VARIABLE)) {
    throw new Error(
      `"${contract.slug}" generates inside a viewport stand-in frame whose width binds ` +
        `"${VIEWPORT_FRAME_WIDTH_VARIABLE}", which this design system does not define.`,
    );
  }
  if (viewport.backdropPart) {
    const cells = plan.partBindings?.[viewport.backdropPart] ?? [];
    if (cells.length === 0 || cells.some((cell) => !cell.bind.fill)) {
      throw new Error(
        `"${contract.slug}" viewport.backdropPart "${viewport.backdropPart}" requires a ` +
          "CSS-derived fill binding in every variant — a backdrop that paints nothing stays in " +
          "omittedParts instead.",
      );
    }
  }

  const placementPart = viewport.placementPart ?? contract.rootPart;
  const placementIsRoot = placementPart === contract.rootPart;

  let popupWidth: ViewportPopupWidth | undefined;
  // Any width shape other than the exact `min(calc(100vw - var(--m)), <cap>px)` is NOT translated:
  // it stays the resolver's `unsupported` refusal, reported by the coverage gate and the walker,
  // never approximated. Cells of one component (drawer's right/left) must agree on one source.
  const sources = refusedWidthsOf(sourcePlan, placementPart, placementIsRoot);
  const parsed = sources.map((source) => ({ source, parsed: parseViewportPopupWidthCss(source) }));
  if (parsed.length === 1 && parsed[0].parsed) {
    popupWidth = {
      source: parsed[0].source,
      marginVariable: cssVarToFigmaVariableName(parsed[0].parsed.marginVar),
      maxWidthPx: parsed[0].parsed.maxWidthPx,
    };
  }

  // Named the same way: `max-height: calc(100vh - var(--x))` → the frame's block padding binds x.
  // Drawer declares it on its per-side rules; every rule must name the same token.
  let framePaddingBlock: string | undefined;
  const maxHeightVars = new Set<string>();
  let maxHeightsAllMatch = true;
  for (const value of partDeclarations(cssSource, placementPart, "max-height")) {
    const match = POPUP_MAX_HEIGHT_RE.exec(value.trim());
    if (match) maxHeightVars.add(match[1]);
    else maxHeightsAllMatch = false;
  }
  if (maxHeightsAllMatch && maxHeightVars.size === 1) {
    framePaddingBlock = cssVarToFigmaVariableName([...maxHeightVars][0]);
  }

  // Corner: the CSS's own `bottom|right|…: var(--x)` offsets on the placement part, BY NAME.
  let cornerOffsets: GenerationContractViewport["cornerOffsets"];
  if (viewport.placement === "corner") {
    const edges = cornerEdges(viewport.corner ?? "") ?? [];
    cornerOffsets = {};
    for (const edge of edges) {
      const values = partDeclarations(cssSource, placementPart, edge);
      const match = values.length === 1 ? /^var\(\s*(--[a-zA-Z0-9-]+)\s*\)$/.exec(values[0]) : null;
      if (!match) {
        throw new Error(
          `"${contract.slug}" viewport.corner "${viewport.corner}" needs "${placementPart}" CSS to ` +
            `declare \`${edge}: var(--token)\` — the frame's ${edge} padding binds that token by name.`,
        );
      }
      cornerOffsets[edge] = cssVarToFigmaVariableName(match[1]);
    }
  }

  const compiled: GenerationContractViewport = {
    ...viewport,
    frameWidthVariable: VIEWPORT_FRAME_WIDTH_VARIABLE,
    ...(framePaddingBlock ? { framePaddingBlock } : {}),
    ...(popupWidth ? { popupWidth } : {}),
    ...(cornerOffsets ? { cornerOffsets } : {}),
  };
  return { viewport: compiled, plan: applyViewportPopupWidth(plan, popupWidth) };
}
