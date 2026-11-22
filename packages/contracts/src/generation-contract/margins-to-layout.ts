/**
 * Margins as auto-layout, resolved at the plan layer.
 *
 * Figma has no margin, and a wrapper frame would confuse the component structure, so a part's
 * margin is expressed through the PARENT's ordinary padding and gap, which the walker and the
 * skill emitter already apply:
 *
 *   - a LEADING margin on the first in-flow child (main axis) is the parent's padding on that side;
 *   - a TRAILING margin on the last in-flow child is the parent's padding on the opposite side;
 *   - the margin BETWEEN siblings, when it is the same token at every boundary, is the parent's gap;
 *   - a CROSS-axis margin is the parent's cross-axis padding, only when there is one in-flow child.
 *
 * A mapping is made only when it is exact and binds to ONE variable: the parent's padding (or gap)
 * is unset, or the parent's value plus the margin equals one existing `spacing/*` token. Nothing
 * else is guessed: summing without a matching token, siblings whose margins differ, a margin on a
 * node with no in-flow parent, and every `auto` or negative value (refused earlier, by the
 * resolver) are reported in `refusedMargins` instead.
 *
 * The result carries ordinary padding and gap, and no margin geometry at all.
 */
import { getResolvedTokenPxValues, normalizeVariableName } from "../registry/resolver";
import type {
  ResolvedComponentPlan,
  ResolvedPlanCell,
  ResolvedPlanGeometry,
} from "../resolved-plan/types";
import { resolveByAxis } from "./resolve-by-axis";
import type { FigmaGenerationContract, GenerationContractAnatomyNode } from "./types";

/**
 * THE strictness rule for margins that sit on one kind of child among others (a separator
 * between rows, a leading separator in a list). When `true`:
 *   - a sibling-boundary margin maps to the parent's gap only when EVERY child the parent can
 *     contain carries the same margin token, so a margin on one child type (the separator) never
 *     becomes a gap that every sibling would share;
 *   - a leading or trailing margin maps to the parent's padding only when the part is
 *     structurally the parent's first or last child by its CSS (a `::before` or `::after`
 *     pseudo part), not merely whichever part is first in the example anatomy.
 * Anything else is refused and reported. Set to `false` for the looser, anatomy-exact mapping
 * (exact for the rendered example, but it changes spacing a real list would not have).
 */
export const STRICT_MARGIN_MAPPING = true;

type Side = "Top" | "Right" | "Bottom" | "Left";
const SIDES: readonly Side[] = ["Top", "Right", "Bottom", "Left"];
type MarginKey = `margin${Side}`;
type PaddingKey = `padding${Side}`;

/** The geometry key holding a side's margin. */
const marginKey = (side: Side): MarginKey => `margin${side}`;
/** The geometry key holding a side's padding. */
const paddingKey = (side: Side): PaddingKey => `padding${side}`;
/** The symmetric padding key a side belongs to. */
const symmetricPadding = (side: Side): "paddingBlock" | "paddingInline" =>
  side === "Top" || side === "Bottom" ? "paddingBlock" : "paddingInline";
/** The CSS longhand a side's margin reports under. */
const marginProperty = (side: Side): string => `margin-${side.toLowerCase()}`;

/** One in-flow child instance of a parent, in layout order. */
interface FlowChild {
  part: string;
  node: GenerationContractAnatomyNode;
}

/** Whether a variant key satisfies a condition. An absent condition always matches. */
export function matches(
  key: Readonly<Record<string, string>>,
  condition: Record<string, string | string[]> | undefined,
): boolean {
  return Object.entries(condition ?? {}).every(([axis, value]) =>
    Array.isArray(value) ? value.includes(key[axis]) : key[axis] === value,
  );
}

/** Whether an anatomy child renders in the cell `key` (its `when` holds and its `unless` does not). */
export function rendersIn(
  key: Readonly<Record<string, string>>,
  child: GenerationContractAnatomyNode,
): boolean {
  return matches(key, child.when) && !(child.unless && matches(key, child.unless));
}

/**
 * The `spacing/<n>` token whose px value is exactly `px`, when exactly one exists in the
 * injected token values; `undefined` when no token map is set, none matches, or several do.
 */
export function spacingTokenForPx(px: number): string | undefined {
  const values = getResolvedTokenPxValues();
  if (!values) return undefined;
  const hits: string[] = [];
  for (const [key, value] of values) {
    const match = /^spacing(\d+)$/.exec(key);
    if (match && value === px) hits.push(`spacing/${match[1]}`);
  }
  return hits.length === 1 ? hits[0] : undefined;
}

/** A `spacing/<n>` token's px value, or `undefined` for anything else or an unknown token. */
function spacingPx(token: string): number | undefined {
  return getResolvedTokenPxValues()?.get(normalizeVariableName(token));
}

/**
 * Add spacing tokens into one existing token, or `undefined`. An unset (`undefined`) addend
 * counts as 0, so a single token passes through unchanged and needs no token map.
 */
export function sumSpacingTokens(...tokens: Array<string | undefined>): string | undefined {
  const present = tokens.filter((token): token is string => token !== undefined);
  if (present.length === 1) return present[0];
  let total = 0;
  for (const token of present) {
    const px = spacingPx(token);
    if (px === undefined) return undefined;
    total += px;
  }
  return spacingTokenForPx(total);
}

/**
 * Resolve every part's margins into its parent's padding and gap, per variant cell, and report
 * what cannot be mapped exactly. Returns the plan unchanged when it declares no margin.
 */
export function mapMarginsToLayout(
  contract: FigmaGenerationContract,
  plan: ResolvedComponentPlan,
): ResolvedComponentPlan {
  const hasMargin = (geometry: ResolvedPlanGeometry | undefined) =>
    geometry !== undefined && SIDES.some((side) => geometry[marginKey(side)] !== undefined);
  const parts = Object.values(plan.partBindings ?? {});
  const anyMargin =
    parts.some((cells) => cells.some((cell) => hasMargin(cell.geometry))) ||
    plan.variantMatrix.some((cell) => hasMargin(cell.geometry)) ||
    hasMargin(plan.baseGeometry);
  if (!anyMargin) return plan;

  const refused: Record<string, string> = { ...(plan.refusedMargins ?? {}) };
  const variantMatrix: ResolvedPlanCell[] = plan.variantMatrix.map((cell) => ({
    ...cell,
    ...(cell.geometry ? { geometry: { ...cell.geometry } } : {}),
  }));
  const partBindings: Record<string, ResolvedPlanCell[]> = Object.fromEntries(
    Object.entries(plan.partBindings ?? {}).map(([part, cells]) => [
      part,
      cells.map((cell) => ({
        ...cell,
        ...(cell.geometry ? { geometry: { ...cell.geometry } } : {}),
      })),
    ]),
  );
  const root = contract.rootPart;
  const baseGeometry: ResolvedPlanGeometry = { ...plan.baseGeometry };

  /** The geometry object a part's cell owns (created for the root when the cell has none). */
  const ownGeometry = (part: string, index: number): ResolvedPlanGeometry | undefined => {
    if (part === root) {
      const cell = variantMatrix[index];
      cell.geometry ??= {};
      return cell.geometry;
    }
    // A part with a cell but no geometry of its own is still a frame that can carry padding.
    const cell = partBindings[part]?.[index];
    if (!cell) return undefined;
    cell.geometry ??= {};
    return cell.geometry;
  };
  /** A part's geometry as consumers read it: the root inherits the base, a part does not. */
  const readGeometry = (part: string, index: number): ResolvedPlanGeometry =>
    part === root
      ? { ...plan.baseGeometry, ...(variantMatrix[index].geometry ?? {}) }
      : (partBindings[part]?.[index]?.geometry ?? {});

  const refuse = (part: string, side: Side, token: string, why: string) => {
    refused[`${part} ${marginProperty(side)}`] = `${marginProperty(side)}: ${token} — ${why}`;
  };

  /** The effective padding token on a side (its own key, else its symmetric axis key). */
  const effectivePadding = (geometry: ResolvedPlanGeometry, side: Side): string | undefined =>
    geometry[paddingKey(side)] ?? geometry[symmetricPadding(side)];

  /**
   * Add `margin` to the parent's padding on `side`: the margin alone when the side is unset,
   * the sum when it equals one existing token, otherwise a refusal on `childPart`.
   */
  const addToPadding = (
    parentPart: string,
    index: number,
    side: Side,
    margin: string,
    childPart: string,
    childSide: Side,
  ): void => {
    const geometry = ownGeometry(parentPart, index);
    if (!geometry) {
      refuse(childPart, childSide, margin, `parent "${parentPart}" has no geometry to carry it`);
      return;
    }
    const current = effectivePadding(readGeometry(parentPart, index), side);
    const next = sumSpacingTokens(current, margin);
    if (next === undefined) {
      refuse(
        childPart,
        childSide,
        margin,
        `adds to the parent's ${paddingKey(side)} (${current}) and the sum is no existing token`,
      );
      return;
    }
    // A symmetric axis value would also set the opposite side: split it first.
    const symmetric = symmetricPadding(side);
    if (geometry[symmetric] !== undefined) {
      const opposite = SIDES.find(
        (other) => other !== side && symmetricPadding(other) === symmetric,
      ) as Side;
      geometry[paddingKey(opposite)] = geometry[symmetric];
      delete geometry[symmetric];
    }
    geometry[paddingKey(side)] = next;
  };

  plan.variantMatrix.forEach((cell, index) => {
    const key = cell.key;
    /** Parts visible in this cell but removed from flow: their margins have nothing to inset. */
    const outOfFlow = new Set<string>();

    /** The in-flow instances of `node`'s children for this cell, in layout order. */
    const flowChildren = (node: GenerationContractAnatomyNode): FlowChild[] => {
      const out: FlowChild[] = [];
      for (const child of node.children ?? []) {
        if (!rendersIn(key, child)) continue;
        if (resolveByAxis(child.removeFromFlowByAxis, child.removeFromFlow, key)) {
          // Visible but out of flow: no sibling or parent mapping reads it, so it is refused below.
          outOfFlow.add(child.part);
          continue;
        }
        const count = child.items?.length ?? child.repeat ?? 1;
        for (let i = 0; i < count; i++) out.push({ part: child.part, node: child });
      }
      return out;
    };

    const visit = (node: GenerationContractAnatomyNode): void => {
      const layout =
        resolveByAxis(node.layoutByAxis, node.layout, key) ??
        (readGeometry(node.part, index).layoutMode === "VERTICAL" ? "vertical" : "horizontal");
      const children = flowChildren(node);
      const isFlow = layout === "horizontal" || layout === "vertical";
      const lead: Side = layout === "vertical" ? "Top" : "Left";
      const trail: Side = layout === "vertical" ? "Bottom" : "Right";
      const crossSides: Side[] = layout === "vertical" ? ["Left", "Right"] : ["Top", "Bottom"];

      const marginsOf = (child: FlowChild, side: Side): string | undefined =>
        readGeometry(child.part, index)[marginKey(side)];

      if (children.some((child) => SIDES.some((side) => marginsOf(child, side)))) {
        const seen = new Set<string>();
        for (const [position, child] of children.entries()) {
          for (const side of SIDES) {
            const token = marginsOf(child, side);
            if (!token) continue;
            const reportKey = `${child.part}|${side}|${position}`;
            if (seen.has(reportKey)) continue;
            seen.add(reportKey);
            const parentIsReal =
              node.part === root || partBindings[node.part] !== undefined || !node.synthetic;
            if (!isFlow || !parentIsReal) {
              refuse(
                child.part,
                side,
                token,
                isFlow
                  ? `parent "${node.part}" is synthetic and carries no padding`
                  : "the parent is an overlay: margins have no flow to inset in",
              );
              continue;
            }
            if (side === lead || side === trail) {
              const first = position === 0;
              const last = position === children.length - 1;
              const structurallyFirst = !STRICT_MARGIN_MAPPING || child.part.endsWith("::before");
              const structurallyLast = !STRICT_MARGIN_MAPPING || child.part.endsWith("::after");
              if (side === lead && first && structurallyFirst) {
                addToPadding(node.part, index, lead, token, child.part, side);
              } else if (side === trail && last && structurallyLast) {
                addToPadding(node.part, index, trail, token, child.part, side);
              } else if ((side === lead && first) || (side === trail && last)) {
                refuse(
                  child.part,
                  side,
                  token,
                  "the part is not structurally the parent's first or last child by its CSS, only in the example anatomy",
                );
              } else {
                // An interior margin: handled per boundary below.
              }
            } else if (crossSides.includes(side)) {
              if (children.length === 1) {
                addToPadding(node.part, index, side, token, child.part, side);
              } else {
                refuse(
                  child.part,
                  side,
                  token,
                  "a cross-axis margin maps to padding only when the parent has one in-flow child",
                );
              }
            }
          }
        }

        // Margins between siblings: one token at every boundary becomes the parent's gap.
        if (isFlow && children.length > 1) {
          const boundaries: Array<{ tokens: string[]; owners: Array<[FlowChild, Side, string]> }> =
            [];
          for (let b = 0; b < children.length - 1; b++) {
            const trailing = marginsOf(children[b], trail);
            const leading = marginsOf(children[b + 1], lead);
            const owners: Array<[FlowChild, Side, string]> = [];
            if (trailing) owners.push([children[b], trail, trailing]);
            if (leading) owners.push([children[b + 1], lead, leading]);
            boundaries.push({ tokens: owners.map(([, , t]) => t), owners });
          }
          const withMargin = boundaries.filter((boundary) => boundary.owners.length > 0);
          if (withMargin.length > 0) {
            const reportAll = (why: string) => {
              for (const boundary of withMargin) {
                for (const [child, side, token] of boundary.owners) {
                  refuse(child.part, side, token, why);
                }
              }
            };
            const perBoundary = withMargin.map((boundary) => sumSpacingTokens(...boundary.tokens));
            // The margin must be on the FLOW axis (start or end), the boundary side a gap replaces:
            // a cross-axis margin on a child type does not count towards a shared gap.
            const everyChildCarriesIt =
              !STRICT_MARGIN_MAPPING ||
              (node.children ?? []).every(
                (declared) =>
                  resolveByAxis(declared.removeFromFlowByAxis, declared.removeFromFlow, key) ||
                  [lead, trail].some((side) => readGeometry(declared.part, index)[marginKey(side)]),
              );
            const uniform =
              everyChildCarriesIt &&
              withMargin.length === boundaries.length &&
              perBoundary.every((token) => token !== undefined && token === perBoundary[0]);
            if (!uniform) {
              reportAll(
                "sibling margins differ, are missing at some boundary, or sit on only one kind of child, so no single gap matches",
              );
            } else {
              const geometry = ownGeometry(node.part, index);
              const gap = geometry
                ? sumSpacingTokens(readGeometry(node.part, index).gap, perBoundary[0])
                : undefined;
              if (!geometry || gap === undefined) {
                reportAll("adds to the parent's gap and the sum is no existing token");
              } else {
                geometry.gap = gap;
              }
            }
          }
        }
      }
      for (const child of node.children ?? []) {
        // A container this cell does not render must not add padding or refusals.
        if (rendersIn(key, child)) visit(child);
      }
    };
    if (contract.anatomy) visit(contract.anatomy);

    for (const part of outOfFlow) {
      for (const side of SIDES) {
        const token = readGeometry(part, index)[marginKey(side)];
        if (token && !refused[`${part} ${marginProperty(side)}`]) {
          refuse(
            part,
            side,
            token,
            "the part is removed from flow, so its margin has nothing to inset",
          );
        }
      }
    }
  });

  // The root has no parent to inset it in, so a margin on it (in a cell or inherited from the
  // base geometry) is refused rather than silently dropped.
  for (const geometry of [baseGeometry, ...variantMatrix.map((cell) => cell.geometry)]) {
    for (const side of SIDES) {
      const token = geometry?.[marginKey(side)];
      if (token && !refused[`${root} ${marginProperty(side)}`]) {
        refuse(root, side, token, "the root has no parent to inset it in");
      }
    }
  }

  // No margin geometry survives: consumers only ever see padding and gap.
  const strip = (geometry: ResolvedPlanGeometry | undefined) => {
    if (!geometry) return;
    for (const side of SIDES) delete geometry[marginKey(side)];
  };
  strip(baseGeometry);
  for (const cell of variantMatrix) strip(cell.geometry);
  for (const cells of Object.values(partBindings)) for (const cell of cells) strip(cell.geometry);

  // Keep a stable order, and drop an empty geometry the stripping may have left behind.
  for (const cell of variantMatrix) {
    if (cell.geometry && Object.keys(cell.geometry).length === 0) delete cell.geometry;
  }
  for (const cells of Object.values(partBindings)) {
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
