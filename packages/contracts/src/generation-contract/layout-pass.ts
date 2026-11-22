/**
 * Shared scaffolding for the plan-layer passes that turn a resolved CSS intent into an
 * auto-layout property on the PARENT (or refuse it): `fill-inset.ts`, `wrap-to-layout.ts`,
 * `translate-to-align.ts` and `inset-constraints.ts`, siblings of `align-self-to-parent.ts` and
 * `margins-to-layout.ts`.
 *
 * A pass works on a private copy of the plan: it reads each part's per-cell geometry (the root's
 * is its base geometry overlaid by the cell's own), writes through `own`, reports what it cannot
 * map exactly under `<part> <property>` in `refusedMargins`, and returns the plan, or the SAME
 * plan object when it had nothing to do.
 */
import type {
  ResolvedComponentPlan,
  ResolvedPlanCell,
  ResolvedPlanGeometry,
} from "../resolved-plan/types";
import { rendersIn } from "./margins-to-layout";
import { resolveByAxis } from "./resolve-by-axis";
import type { FigmaGenerationContract, GenerationContractAnatomyNode } from "./types";

export type FlowLayout = "horizontal" | "vertical" | "overlay";

export interface LayoutPass {
  readonly contract: FigmaGenerationContract;
  readonly plan: ResolvedComponentPlan;
  readonly variantMatrix: ResolvedPlanCell[];
  readonly partBindings: Record<string, ResolvedPlanCell[]>;
  /** The pass's copy of the root's base geometry. */
  readonly baseGeometry: ResolvedPlanGeometry;
  /** The part's geometry in cell `index` (the root's merged over the base geometry). */
  read(part: string, index: number): ResolvedPlanGeometry;
  /** The part's own, writable geometry in cell `index`, or `undefined` when it has none to carry. */
  own(part: string, index: number): ResolvedPlanGeometry | undefined;
  /** Record a refusal under `<part> <property>`. */
  refuse(part: string, property: string, reason: string): void;
  /** How `node` lays its children out in the cell `key`. */
  layoutOf(node: GenerationContractAnatomyNode, index: number): FlowLayout;
  /** Visit every rendered parent → child edge of cell `index`, children after their parent. */
  edges(
    index: number,
    visit: (
      parent: GenerationContractAnatomyNode,
      child: GenerationContractAnatomyNode,
      removedFromFlow: boolean,
    ) => void,
  ): void;
  /** Visit every rendered node of cell `index` (the root included), parents first. */
  nodes(index: number, visit: (node: GenerationContractAnatomyNode) => void): void;
  /** The plan with the pass's edits (and refusals), or the original plan if `changed` stayed false. */
  result(): ResolvedComponentPlan;
  changed: boolean;
}

/** Copies a plan cell and its geometry so a pass can edit it without touching the input. */
const copyCell = (cell: ResolvedPlanCell): ResolvedPlanCell => ({
  ...cell,
  ...(cell.geometry ? { geometry: { ...cell.geometry } } : {}),
});

/**
 * Creates a working copy of a plan with helpers to read and write per-part geometry, walk
 * parent-child pairs and record refusals.
 */
export function createLayoutPass(
  contract: FigmaGenerationContract,
  plan: ResolvedComponentPlan,
): LayoutPass {
  const refused: Record<string, string> = { ...(plan.refusedMargins ?? {}) };
  const variantMatrix = plan.variantMatrix.map(copyCell);
  const partBindings: Record<string, ResolvedPlanCell[]> = Object.fromEntries(
    Object.entries(plan.partBindings ?? {}).map(([part, cells]) => [part, cells.map(copyCell)]),
  );
  const root = contract.rootPart;
  const baseGeometry: ResolvedPlanGeometry = { ...plan.baseGeometry };

  const pass: LayoutPass = {
    contract,
    plan,
    variantMatrix,
    partBindings,
    baseGeometry,
    changed: false,
    read(part, index) {
      return part === root
        ? { ...baseGeometry, ...(variantMatrix[index].geometry ?? {}) }
        : (partBindings[part]?.[index]?.geometry ?? {});
    },
    own(part, index) {
      if (part === root) {
        variantMatrix[index].geometry ??= {};
        return variantMatrix[index].geometry;
      }
      const cell = partBindings[part]?.[index];
      if (!cell) return undefined;
      cell.geometry ??= {};
      return cell.geometry;
    },
    refuse(part, property, reason) {
      refused[`${part} ${property}`] = reason;
      pass.changed = true;
    },
    layoutOf(node, index) {
      const key = variantMatrix[index].key;
      const declared = resolveByAxis(node.layoutByAxis, node.layout, key);
      if (declared) return declared;
      return pass.read(node.part, index).layoutMode === "VERTICAL" ? "vertical" : "horizontal";
    },
    edges(index, visit) {
      const key = variantMatrix[index].key;
      const walk = (node: GenerationContractAnatomyNode): void => {
        for (const child of node.children ?? []) {
          if (!rendersIn(key, child)) continue;
          const removed = Boolean(
            resolveByAxis(child.removeFromFlowByAxis, child.removeFromFlow, key),
          );
          visit(node, child, removed);
          walk(child);
        }
      };
      if (contract.anatomy) walk(contract.anatomy);
    },
    nodes(index, visit) {
      const key = variantMatrix[index].key;
      const walk = (node: GenerationContractAnatomyNode): void => {
        visit(node);
        for (const child of node.children ?? []) if (rendersIn(key, child)) walk(child);
      };
      if (contract.anatomy) walk(contract.anatomy);
    },
    result() {
      if (!pass.changed) return plan;
      const dropEmpty = (cells: ResolvedPlanCell[]) => {
        for (const cell of cells) {
          if (cell.geometry && Object.keys(cell.geometry).length === 0) delete cell.geometry;
        }
      };
      dropEmpty(variantMatrix);
      for (const cells of Object.values(partBindings)) dropEmpty(cells);
      return {
        ...plan,
        baseGeometry,
        variantMatrix,
        partBindings,
        ...(Object.keys(refused).length > 0
          ? {
              refusedMargins: Object.fromEntries(
                Object.entries(refused).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
              ),
            }
          : {}),
      };
    },
  };
  return pass;
}

/** Drop intermediate keys from every geometry the pass holds, anatomy or not. */
export function stripIntermediates(
  pass: LayoutPass,
  keys: ReadonlyArray<keyof ResolvedPlanGeometry>,
) {
  const strip = (geometry: ResolvedPlanGeometry | undefined) => {
    if (!geometry) return;
    for (const key of keys) delete geometry[key];
  };
  strip(pass.baseGeometry);
  for (const cell of pass.variantMatrix) strip(cell.geometry);
  for (const cells of Object.values(pass.partBindings))
    for (const cell of cells) strip(cell.geometry);
  pass.changed = true;
}

/** Every geometry the plan holds: the base, each root cell, each part cell. */
export function forEachGeometry(
  plan: ResolvedComponentPlan,
  visit: (geometry: ResolvedPlanGeometry) => void,
): void {
  visit(plan.baseGeometry);
  for (const cell of plan.variantMatrix) if (cell.geometry) visit(cell.geometry);
  for (const cells of Object.values(plan.partBindings ?? {})) {
    for (const cell of cells) if (cell.geometry) visit(cell.geometry);
  }
}

/** Whether any geometry in the plan satisfies `test`. */
export function anyGeometry(
  plan: ResolvedComponentPlan,
  test: (geometry: ResolvedPlanGeometry) => boolean,
): boolean {
  let found = false;
  forEachGeometry(plan, (geometry) => {
    if (test(geometry)) found = true;
  });
  return found;
}
