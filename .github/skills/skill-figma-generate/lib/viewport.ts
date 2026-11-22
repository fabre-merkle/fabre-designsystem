/**
 * The viewport stand-in frame and the popup component — the PURE decisions for a window-placed
 * component (dialog, alert-dialog, drawer, toast), taken from the compiled V2 artifact and
 * nothing else.
 *
 * Window-placed components: a component whose CSS places its popup against the
 * browser window (`position: fixed`) is generated with a `context` axis. A `context=viewport`
 * variant is a stand-in for the window: a frame whose width binds the existing
 * `web/breakpoint/view` variable, whose height hugs, whose padding binds BY NAME the margin token
 * the CSS reserves, with the backdrop rendered from its own CSS behind the popup, and the popup
 * placed `center` / `docked` / `corner` as the contract declares. A `context=component` variant is
 * the bare popup.
 *
 * Owner decision 2026-10-05: the bare popup is its OWN component, `<ComponentName> Popup`
 * (a component set when the popup keeps other axes, e.g. Drawer's `side`), generated BEFORE the
 * viewport set. Every variant of the viewport set — both contexts — holds an INSTANCE of the
 * matching popup variant, so the popup component is the one definition Code Connect maps.
 *
 * This is the skill's mirror of the Figma plugin's `viewportFramePlan` and
 * `withPopupComponent`; the parity tests compare
 * them for every viewport component of the committed artifact. Every value comes from the
 * compiled contract (the build computed it from the CSS) or the backdrop's own resolved cell —
 * nothing is computed here. A contract that cannot be honoured throws with the remediation,
 * exactly as the plugin does: never a guessed frame.
 *
 * Standalone by construction: imports only the skill's own `artifact.ts`. PURE: no Figma I/O.
 */
import type { ArtifactComponent, ResolvedGeometry, ViewportEdge, ViewportPlacement } from "./artifact";

/** The axis the contract build adds to a window-placed component, and its two values. */
export const VIEWPORT_CONTEXT_AXIS_PROP = "context";
export const VIEWPORT_CONTEXT_VIEWPORT = "viewport";
export const VIEWPORT_CONTEXT_COMPONENT = "component";

export type FrameAlign = "MIN" | "CENTER" | "MAX";

/** The viewport stand-in frame of one `context=viewport` cell. Variable names, never values. */
export interface ViewportFramePlan {
  /** The contract's root part: the layer name of the popup instance inside the frame. */
  popupPart: string;
  placement: ViewportPlacement;
  /** The existing `web/breakpoint/view` variable — switching the web mode resizes the frame. */
  width: string;
  /** Frame padding per side, each the token the component's own CSS names. */
  padding: Partial<Record<ViewportEdge, string>>;
  /** Where the popup sits: the (vertical) frame's alignment on its main / cross axes. */
  align: { primary: FrameAlign; counter: FrameAlign };
  /**
   * `capped`: FILL up to the CSS `min()`'s cap. `fill`: FILL, no cap (a drawer docked top/bottom).
   * `hug`: no build-computed width exists — the popup hugs and the run reports it.
   */
  popupWidth: { mode: "capped"; maxWidthPx: number } | { mode: "fill" } | { mode: "hug" };
  /** A visible backdrop, stretched over the frame behind the popup, from its own CSS. */
  backdrop?: {
    part: string;
    fill?: string;
    fillOpacity?: number;
    stroke?: string;
    strokeOpacity?: number;
    effectStyle?: string;
  };
}

/** The bare popup as its own component — the Code Connect target. */
export interface PopupComponentPlan {
  /** `<ComponentName> Popup`. */
  name: string;
  /** The contract's root part: the layer name every viewport-set variant gives its popup instance. */
  part: string;
  /** True when `context` is the only axis: one `COMPONENT`, no set. */
  standalone: boolean;
  /** One per `context=component` cell, in matrix order. `variantName` has no `context=` entry. */
  variants: Array<{ cellIndex: number; key: Record<string, string>; variantName: string }>;
}

/** The popup component's Figma name: the React component's name plus `Popup`. */
export function popupComponentName(componentName: string): string {
  return `${componentName} Popup`;
}

/** `"<top|bottom>-<left|right>"` → its block and inline edges. */
export function cornerEdges(corner: string): [ViewportEdge, ViewportEdge] | undefined {
  const [block, inline] = corner.split("-");
  if ((block !== "top" && block !== "bottom") || (inline !== "left" && inline !== "right")) return undefined;
  return [block, inline];
}

const named = (name: string | undefined): string | undefined => name || undefined;

/**
 * PURE. The viewport stand-in frame for one cell, or `undefined` when the contract declares no
 * viewport or the cell is not `context=viewport`. `geometry` is the cell's merged root geometry:
 * the build rewrote a CSS `min()` width to `fill` on the cells it applies to.
 */
export function viewportFramePlan(component: ArtifactComponent, cellIndex: number): ViewportFramePlan | undefined {
  const { contract, resolvedPlan } = component;
  const viewport = contract.viewport;
  const cell = resolvedPlan.variantMatrix[cellIndex];
  if (!viewport || !cell || cell.key[VIEWPORT_CONTEXT_AXIS_PROP] !== VIEWPORT_CONTEXT_VIEWPORT) return undefined;
  if (!viewport.frameWidthVariable) {
    throw new Error(`"${contract.slug}" declares a viewport but its compiled contract has no frameWidthVariable — rebuild the artifact.`);
  }
  const geometry: ResolvedGeometry = { ...resolvedPlan.baseGeometry, ...cell.geometry };
  const backdropCell = viewport.backdropPart ? resolvedPlan.partBindings?.[viewport.backdropPart]?.[cellIndex] : undefined;
  const margin = named(viewport.popupWidth?.marginVariable);
  const marginBlock = named(viewport.framePaddingBlock);
  // A `placementPart` that is not the root (toast) carries the width for every cell.
  const widthIsCapped = viewport.popupWidth !== undefined && (geometry.width?.kind === "fill" || viewport.placementPart !== undefined);
  const cappedWidth = (): ViewportFramePlan["popupWidth"] =>
    widthIsCapped && viewport.popupWidth ? { mode: "capped", maxWidthPx: viewport.popupWidth.maxWidthPx } : { mode: "hug" };

  let padding: ViewportFramePlan["padding"];
  let align: ViewportFramePlan["align"];
  let popupWidth: ViewportFramePlan["popupWidth"];
  switch (viewport.placement) {
    case "center":
      padding = { left: margin, right: margin, top: marginBlock, bottom: marginBlock };
      align = { primary: "CENTER", counter: "CENTER" };
      popupWidth = cappedWidth();
      break;
    case "docked": {
      const dock = viewport.dock;
      const edge = dock ? dock.edges[cell.key[dock.axis]] : undefined;
      if (!dock || !edge) {
        throw new Error(`"${contract.slug}" docks its popup by axis "${dock?.axis}" but variant ${JSON.stringify(cell.key)} has no docking edge — rebuild the artifact.`);
      }
      // The CSS margin the popup's size reserves lands on the edge OPPOSITE the dock.
      if (edge === "bottom" || edge === "top") {
        padding = edge === "bottom" ? { top: marginBlock } : { bottom: marginBlock };
        align = { primary: edge === "bottom" ? "MAX" : "MIN", counter: "MIN" };
        popupWidth = { mode: "fill" };
      } else {
        padding = edge === "right" ? { left: margin } : { right: margin };
        align = { primary: "MIN", counter: edge === "right" ? "MAX" : "MIN" };
        popupWidth = cappedWidth();
      }
      break;
    }
    case "corner": {
      const edges = viewport.corner ? cornerEdges(viewport.corner) : undefined;
      if (!edges) throw new Error(`"${contract.slug}" declares a corner placement without a valid corner — rebuild the artifact.`);
      const [block, inline] = edges;
      const offsets = viewport.cornerOffsets ?? {};
      // Offsets bind on the corner's own edges; the width margin reserves the far horizontal edge.
      padding = { [block]: named(offsets[block]), [inline]: named(offsets[inline]), [inline === "right" ? "left" : "right"]: margin };
      align = { primary: block === "bottom" ? "MAX" : "MIN", counter: inline === "right" ? "MAX" : "MIN" };
      popupWidth = cappedWidth();
      break;
    }
    default:
      throw new Error(`"${contract.slug}" declares an unknown viewport placement "${String(viewport.placement)}" — rebuild the artifact.`);
  }
  return {
    popupPart: contract.rootPart,
    placement: viewport.placement,
    width: viewport.frameWidthVariable,
    padding,
    align,
    popupWidth,
    ...(viewport.backdropPart
      ? {
          backdrop: {
            part: viewport.backdropPart,
            fill: named(backdropCell?.bind.fill),
            ...(backdropCell?.bind.fillOpacity !== undefined ? { fillOpacity: backdropCell.bind.fillOpacity } : {}),
            stroke: named(backdropCell?.bind.stroke),
            ...(backdropCell?.bind.strokeOpacity !== undefined ? { strokeOpacity: backdropCell.bind.strokeOpacity } : {}),
            effectStyle: backdropCell?.bind.effectStyle,
          },
        }
      : {}),
  };
}

/** A variant name with its `context=…` entry dropped (`"side=down, context=viewport"` → `"side=down"`). */
export function withoutContext(variantName: string): string {
  return variantName
    .split(", ")
    .filter((entry) => !entry.startsWith(`${VIEWPORT_CONTEXT_AXIS_PROP}=`))
    .join(", ");
}

/**
 * PURE. The popup component of a viewport-bearing component, built from its `context=component`
 * cells with the context axis dropped; `undefined` when the contract declares no viewport.
 */
export function popupComponentPlan(component: ArtifactComponent): PopupComponentPlan | undefined {
  const { contract, resolvedPlan } = component;
  if (!contract.viewport) return undefined;
  const name = popupComponentName(contract.componentName);
  const bare = resolvedPlan.variantMatrix
    .map((cell, cellIndex) => ({ cell, cellIndex }))
    .filter(({ cell }) => cell.key[VIEWPORT_CONTEXT_AXIS_PROP] === VIEWPORT_CONTEXT_COMPONENT);
  const standalone = bare.every(({ cell }) => withoutContext(cell.label) === "");
  if (bare.length === 0 || (standalone && bare.length !== 1)) {
    throw new Error(`"${contract.componentName}" declares a viewport but has no single context=component cell per popup variant — rebuild the artifact.`);
  }
  return {
    name,
    part: contract.rootPart,
    standalone,
    variants: bare.map(({ cell, cellIndex }) => ({ cellIndex, key: cell.key, variantName: standalone ? name : withoutContext(cell.label) })),
  };
}

/**
 * PURE. The popup variant each cell of the viewport set instances (the one whose non-context axis
 * values match), parallel to `variantMatrix`; `undefined` when the contract declares no viewport.
 * Throws when a cell has no matching popup variant.
 */
export function popupVariantsByCell(component: ArtifactComponent, popup: PopupComponentPlan | undefined): string[] | undefined {
  if (!popup) return undefined;
  const names = new Set(popup.variants.map((variant) => variant.variantName));
  return component.resolvedPlan.variantMatrix.map((cell) => {
    const popupVariant = popup.standalone ? popup.name : withoutContext(cell.label);
    if (!names.has(popupVariant)) {
      throw new Error(`"${component.contract.componentName}" variant "${cell.label}" has no matching popup variant — rebuild the artifact.`);
    }
    return popupVariant;
  });
}

/** Every variable name the viewport frames bind — merged into the preflight's token coverage check. */
export function tokensInViewport(frames: ReadonlyArray<ViewportFramePlan | undefined>): string[] {
  const out: string[] = [];
  const add = (name: string | undefined) => {
    if (name && !out.includes(name)) out.push(name);
  };
  for (const frame of frames) {
    if (!frame) continue;
    add(frame.width);
    for (const side of ["top", "right", "bottom", "left"] as const) add(frame.padding[side]);
    add(frame.backdrop?.fill);
    add(frame.backdrop?.stroke);
  }
  return out;
}
