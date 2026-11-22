/**
 * Cross-axis stretch of a column's children — CSS's default, made explicit for Figma.
 *
 * In CSS a block-level box in a block container fills the container's inline size, and every
 * item of a column flex container fills its cross axis while `align-items` is `normal`/`stretch`.
 * Neither is written as a size: it is what CSS does when no width is declared. Figma's auto-layout
 * default is the opposite (a child hugs its content), so without this a menu's item rows hug their
 * label, the highlighted-row background covers the text only, and a separator with a height but no
 * width keeps Figma's 100px default.
 *
 * This pass reads both halves from what the build already holds — the parent's and the child's
 * own CSS (`display`, `flex-direction`, `align-items`, `align-self`, `position`, `width`) and the
 * contract anatomy that says which node is whose parent — and writes `width: fill` for the cells
 * where CSS stretches the child. It never overrides a width the CSS resolved, and it leaves icon
 * and image nodes alone (their box is their content).
 *
 * Text is the exception: a block of text in a column fills the column's width and wraps (CSS never
 * shrinks it to its longest line), so a stretched text node gets `width: fill` too; the walker then
 * switches it to height-only auto-resize. A synthetic composed-child row that declares
 * `docsLayout.justify` also fills, since justify has nothing to act on in a hugging frame, and so
 * does the frame of a slot declared `stretch` (a content region CSS stretches across the column).
 *
 * The one assumption: an element whose CSS declares no `display` is block-level. That is the CSS
 * initial value for the `<div>` every compound part renders; a part that is an inline element
 * declares its `display` (or is a `text` anatomy node, which this pass skips).
 *
 * PURE and Node-free, like the rest of the compiler.
 */
import { parseComponentCss } from "../registry/css-parser";
import type {
  ResolvedComponentPlan,
  ResolvedPlanCell,
  ResolvedPlanGeometry,
} from "../resolved-plan/types";
import type {
  FigmaGenerationContract,
  GenerationContractAnatomyNode,
  GenerationContractLayout,
} from "./types";

/** Outer display values that generate a block-level box. */
const BLOCK_LEVEL_DISPLAYS: ReadonlySet<string> = new Set([
  "block",
  "flex",
  "grid",
  "flow-root",
  "list-item",
  "table",
]);

/** `align-items`/`align-self` values that keep (or defer to) the stretch default. */
const STRETCH_ALIGNMENTS: ReadonlySet<string> = new Set(["normal", "stretch", "auto"]);

/** Node kinds whose Figma box is their content; CSS's stretch is not applied to them. */
const CONTENT_SIZED_KINDS: ReadonlySet<string> = new Set(["icon", "image"]);

/**
 * A synthetic node has no CSS of its own, so it only stretches when its docs layout needs width to
 * distribute along (`justify` on a hugging row moves nothing) or when it is a stretching slot's frame.
 */
function syntheticNeedsFill(
  contract: FigmaGenerationContract,
  child: GenerationContractAnatomyNode,
): boolean {
  if (child.synthetic !== true) return false;
  // A synthetic text node is the block of text a consumer renders inside a region (a panel's
  // paragraph): like any text in a column, it fills the width and wraps.
  if (child.kind === "text") return true;
  if (child.docsLayout?.justify !== undefined) return true;
  return (child.slots ?? []).some(
    (name) => contract.slots?.find((slot) => slot.name === name)?.stretch === true,
  );
}

/**
 * The value of `property` on the part's own unconditional rule — the exact selector
 * `[data-ui="part"]`, outside `@media` — last declaration winning. State and attribute variants
 * (`[data-ui="part"][data-x]`) are not consulted: none of the layout properties this pass reads
 * changes by state in the component set, and a conditional value is not the part's default.
 */
function baseDeclaration(cssSource: string, part: string, property: string): string | undefined {
  const selector = `[data-ui="${part}"]`;
  let value: string | undefined;
  for (const rule of parseComponentCss(cssSource)) {
    if (rule.media.length > 0 || !rule.selectors.includes(selector)) continue;
    for (const declaration of rule.declarations) {
      if (declaration.property === property) value = declaration.value.trim();
    }
  }
  return value;
}

type Column = { kind: "block" } | { kind: "flex-column"; itemsStretch: boolean };

/** How the parent lays out its children, from its own CSS; `undefined` when it is not a column. */
function columnOf(cssSource: string, part: string): Column | undefined {
  const display = baseDeclaration(cssSource, part, "display");
  if (display === undefined || display === "block" || display === "flow-root") {
    return { kind: "block" };
  }
  if (display !== "flex" && display !== "inline-flex") return undefined;
  const direction = baseDeclaration(cssSource, part, "flex-direction");
  if (direction !== "column") return undefined;
  const align = baseDeclaration(cssSource, part, "align-items");
  // Kept even when the items do not stretch: a child's own `align-self` can still stretch it.
  return {
    kind: "flex-column",
    itemsStretch: align === undefined || STRETCH_ALIGNMENTS.has(align),
  };
}

/** Whether CSS stretches `child` across a parent laid out as `column`. */
function cssStretchesChild(cssSource: string, child: string, column: Column): boolean {
  const position = baseDeclaration(cssSource, child, "position");
  if (position === "absolute" || position === "fixed") return false;
  const display = baseDeclaration(cssSource, child, "display");
  if (display === "none" || display === "contents") return false;
  if (column.kind === "flex-column") {
    // A flex item is blockified whatever its own display. Its effective alignment is its own
    // `align-self` unless that is `auto`, in which case the parent's `align-items` decides.
    const alignSelf = baseDeclaration(cssSource, child, "align-self");
    if (alignSelf === undefined || alignSelf === "auto") return column.itemsStretch;
    return STRETCH_ALIGNMENTS.has(alignSelf);
  }
  // `align-self` does not apply in block layout; a block container stretches a block-level child.
  return display === undefined || BLOCK_LEVEL_DISPLAYS.has(display);
}

/** Whether a variant key satisfies a condition. An absent condition always matches. */
function keyMatches(
  key: Record<string, string>,
  condition: Record<string, string | string[]> | undefined,
): boolean {
  if (!condition) return true;
  return Object.entries(condition).every(([axis, value]) =>
    Array.isArray(value) ? value.includes(key[axis] ?? "") : key[axis] === value,
  );
}

/** The layout a node declares for a variant, honouring per-axis overrides. */
function layoutFor(
  node: GenerationContractAnatomyNode,
  key: Record<string, string>,
): GenerationContractLayout | undefined {
  if (node.layoutByAxis) {
    const value = key[node.layoutByAxis.axis];
    return (value !== undefined ? node.layoutByAxis.values[value] : undefined) ?? node.layout;
  }
  return node.layout;
}

/** Whether a node is taken out of the auto-layout flow in a variant. */
function removedFromFlow(
  node: GenerationContractAnatomyNode,
  key: Record<string, string>,
): boolean {
  if (node.removeFromFlowByAxis) {
    const value = key[node.removeFromFlowByAxis.axis];
    const declared = value !== undefined ? node.removeFromFlowByAxis.values[value] : undefined;
    if (declared !== undefined) return declared;
  }
  return node.removeFromFlow === true;
}

/** Returns the geometry with its width set to fill. */
function withFillWidth(geometry: ResolvedPlanGeometry | undefined): ResolvedPlanGeometry {
  return { ...(geometry ?? {}), width: { kind: "fill" } };
}

/**
 * PURE. The plan with `width: fill` on every cell where CSS stretches an anatomy child (text
 * included) across its vertical parent's width and nothing resolved a width for it. A child part with no binding matrix
 * of its own (a part with no CSS, such as a menu group) gets one carrying only that width, keyed
 * like the root's cells.
 */
export function applyColumnStretch(
  contract: FigmaGenerationContract,
  plan: ResolvedComponentPlan,
  cssSource: string,
): ResolvedComponentPlan {
  if (!contract.anatomy) return plan;
  const partBindings: Record<string, ResolvedPlanCell[]> = { ...(plan.partBindings ?? {}) };
  let changed = false;

  const visit = (parent: GenerationContractAnatomyNode): void => {
    const children = parent.children ?? [];
    const column =
      parent.synthetic || parent.kind !== "frame" ? undefined : columnOf(cssSource, parent.part);
    for (const child of children) {
      visit(child);
      if (!column || child.part === contract.rootPart) continue;
      if (CONTENT_SIZED_KINDS.has(child.kind)) continue;
      if (child.synthetic && !syntheticNeedsFill(contract, child)) continue;
      if (!cssStretchesChild(cssSource, child.part, column)) continue;
      const existing = partBindings[child.part];
      const next = plan.variantMatrix.map((rootCell, index): ResolvedPlanCell => {
        const cell = existing?.[index] ?? {
          key: rootCell.key,
          label: rootCell.label,
          bind: {},
        };
        if (
          layoutFor(parent, rootCell.key) !== "vertical" ||
          !keyMatches(rootCell.key, child.when) ||
          (child.unless && keyMatches(rootCell.key, child.unless)) ||
          removedFromFlow(child, rootCell.key) ||
          cell.geometry?.width !== undefined ||
          // A literal width the contract declares for this part and cell is kept, never filled.
          contract.literalGeometry?.some(
            (literal) =>
              literal.part === child.part &&
              literal.width !== undefined &&
              keyMatches(rootCell.key, literal.when),
          )
        ) {
          return cell;
        }
        changed = true;
        return { ...cell, geometry: withFillWidth(cell.geometry) };
      });
      if (existing || next.some((cell) => cell.geometry?.width?.kind === "fill")) {
        partBindings[child.part] = next;
      }
    }
  };
  visit(contract.anatomy);
  return changed ? { ...plan, partBindings } : plan;
}
