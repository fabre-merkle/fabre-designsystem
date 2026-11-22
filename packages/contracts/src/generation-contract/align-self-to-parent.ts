/**
 * `align-self` as the parent's cross-axis alignment, resolved at the plan layer.
 *
 * Figma deprecates a per-child `layoutAlign` of MIN, CENTER or MAX: cross-axis alignment belongs
 * on the parent (`counterAxisAlignItems`), and a wrapper frame is never added to fake a per-child
 * placement. So a child's `align-self` is expressed on its parent, and only when that is exact:
 *
 *   - every in-flow child that declares an `align-self` declares the same one, and
 *   - every other in-flow child fills the cross axis (CSS stretches it), so the parent's
 *     alignment has nothing to move on it.
 *
 * Anything else (siblings that disagree, a sibling that would shift with the parent, an overlay
 * or out-of-flow child, a parent with no geometry to carry it) is not approximated: it is
 * reported in `refusedMargins` under `<part> align-self`, next to the margin refusals the release
 * bar already reads.
 *
 * The result carries `counterAxisAlignItems` on the parent and no `alignSelf` at all.
 */
import type {
  ResolvedComponentPlan,
  ResolvedPlanCell,
  ResolvedPlanGeometry,
} from "../resolved-plan/types";
import { rendersIn } from "./margins-to-layout";
import { resolveByAxis } from "./resolve-by-axis";
import type { FigmaGenerationContract, GenerationContractAnatomyNode } from "./types";

type AlignSelf = NonNullable<ResolvedPlanGeometry["alignSelf"]>;

/** The `refusedMargins` key an `align-self` refusal is reported under for a part. */
const refusalKey = (part: string) => `${part} align-self`;

/**
 * Expresses children's `align-self` as the parent's cross-axis alignment when that is exact, and
 * refuses it (under `<part> align-self`) otherwise. The result never carries `alignSelf`.
 */
export function mapAlignSelfToParent(
  contract: FigmaGenerationContract,
  plan: ResolvedComponentPlan,
): ResolvedComponentPlan {
  const hasAlignSelf = (geometry: ResolvedPlanGeometry | undefined) =>
    geometry?.alignSelf !== undefined;
  const anyAlignSelf =
    Object.values(plan.partBindings ?? {}).some((cells) =>
      cells.some((cell) => hasAlignSelf(cell.geometry)),
    ) ||
    plan.variantMatrix.some((cell) => hasAlignSelf(cell.geometry)) ||
    hasAlignSelf(plan.baseGeometry);
  if (!anyAlignSelf) return plan;

  const refused: Record<string, string> = { ...(plan.refusedMargins ?? {}) };
  const copyCell = (cell: ResolvedPlanCell): ResolvedPlanCell => ({
    ...cell,
    ...(cell.geometry ? { geometry: { ...cell.geometry } } : {}),
  });
  const variantMatrix = plan.variantMatrix.map(copyCell);
  const partBindings: Record<string, ResolvedPlanCell[]> = Object.fromEntries(
    Object.entries(plan.partBindings ?? {}).map(([part, cells]) => [part, cells.map(copyCell)]),
  );
  const baseGeometry: ResolvedPlanGeometry = { ...plan.baseGeometry };
  const root = contract.rootPart;

  const ownGeometry = (part: string, index: number): ResolvedPlanGeometry | undefined => {
    if (part === root) {
      variantMatrix[index].geometry ??= {};
      return variantMatrix[index].geometry;
    }
    const cell = partBindings[part]?.[index];
    if (!cell) return undefined;
    cell.geometry ??= {};
    return cell.geometry;
  };
  const readGeometry = (part: string, index: number): ResolvedPlanGeometry =>
    part === root
      ? { ...plan.baseGeometry, ...(variantMatrix[index].geometry ?? {}) }
      : (partBindings[part]?.[index]?.geometry ?? {});

  const refuse = (part: string, value: AlignSelf, why: string) => {
    refused[refusalKey(part)] = `align-self: ${value} — ${why}`;
  };

  variantMatrix.forEach((cell, index) => {
    const key = cell.key;
    const visit = (node: GenerationContractAnatomyNode): void => {
      const layout =
        resolveByAxis(node.layoutByAxis, node.layout, key) ??
        (readGeometry(node.part, index).layoutMode === "VERTICAL" ? "vertical" : "horizontal");
      const isFlow = layout === "horizontal" || layout === "vertical";
      const crossDimension = layout === "vertical" ? "width" : "height";

      const inFlow: GenerationContractAnatomyNode[] = [];
      for (const child of node.children ?? []) {
        if (!rendersIn(key, child)) continue;
        const alignSelf = readGeometry(child.part, index).alignSelf;
        if (resolveByAxis(child.removeFromFlowByAxis, child.removeFromFlow, key)) {
          if (alignSelf) refuse(child.part, alignSelf, "the part is removed from flow");
          continue;
        }
        if (!isFlow) {
          if (alignSelf) {
            refuse(
              child.part,
              alignSelf,
              "the parent is an overlay: there is no cross axis to align on",
            );
          }
          continue;
        }
        inFlow.push(child);
      }

      const declared = inFlow.flatMap((child) => {
        const value = readGeometry(child.part, index).alignSelf;
        return value ? [{ child, value }] : [];
      });
      if (declared.length > 0) {
        const refuseAll = (why: string) => {
          for (const { child, value } of declared) refuse(child.part, value, why);
        };
        const values = new Set(declared.map(({ value }) => value));
        const value = declared[0].value;
        const geometry = ownGeometry(node.part, index);
        const shifted = inFlow.filter(
          (child) =>
            readGeometry(child.part, index).alignSelf === undefined &&
            readGeometry(child.part, index)[crossDimension]?.kind !== "fill",
        );
        if (values.size > 1) {
          refuseAll("siblings align differently, and the parent holds one cross-axis alignment");
        } else if (shifted.length > 0) {
          refuseAll(
            `the parent's alignment would also move ${shifted.map((c) => `"${c.part}"`).join(", ")}, which neither fills the cross axis nor shares it`,
          );
        } else if (!geometry) {
          refuseAll(`parent "${node.part}" has no geometry to carry the alignment`);
        } else {
          geometry.counterAxisAlignItems = value;
        }
      }
      for (const child of node.children ?? []) {
        // A part this cell does not render contributes neither alignment nor refusals.
        if (!rendersIn(key, child)) continue;
        visit(child);
      }
    };
    if (contract.anatomy) visit(contract.anatomy);
  });

  // The root has no parent to align in.
  for (const geometry of [baseGeometry, ...variantMatrix.map((cell) => cell.geometry)]) {
    if (geometry?.alignSelf && !refused[refusalKey(root)]) {
      refuse(root, geometry.alignSelf, "the root has no parent to align in");
    }
  }

  const strip = (geometry: ResolvedPlanGeometry | undefined) => {
    if (geometry) delete geometry.alignSelf;
  };
  strip(baseGeometry);
  for (const cell of variantMatrix) strip(cell.geometry);
  for (const cells of Object.values(partBindings)) for (const cell of cells) strip(cell.geometry);
  for (const cells of [variantMatrix, ...Object.values(partBindings)]) {
    for (const cell of cells) {
      if (cell.geometry && Object.keys(cell.geometry).length === 0) delete cell.geometry;
    }
  }

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
}
