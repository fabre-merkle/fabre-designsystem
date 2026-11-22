/**
 * `flex-wrap: wrap` as Figma's `layoutWrap`, and `row-gap` as `counterAxisSpacing`.
 *
 * Figma wraps only a HORIZONTAL auto-layout frame, so a wrapping part is mapped when it lays out
 * as a horizontal row and refused (reported under `<part> flex-wrap`) when it does not. The gap
 * between wrapped lines is the CSS `row-gap`, which `gap` also sets, so `counterAxisSpacing` is
 * the part's `row-gap` token, else its `gap` token: both are exact, and neither is a number.
 *
 * `row-gap` on a part that does not wrap is only meaningful in a column, where it IS the gap
 * between items: it becomes the part's `gap`, replacing the row component of any `gap` set before
 * it (the column component, which a column ignores, is left to `column-gap`). In a non-wrapping
 * row it spaces nothing. The `rowGap` intermediate never
 * reaches a compiled plan.
 */
import type { ResolvedComponentPlan, ResolvedPlanGeometry } from "../resolved-plan/types";
import { anyGeometry, createLayoutPass, stripIntermediates } from "./layout-pass";
import type { FigmaGenerationContract } from "./types";

/**
 * Maps `flex-wrap` to auto-layout wrap and `row-gap` to counter-axis spacing on wrapping
 * horizontal rows, and refuses `flex-wrap` on any other layout under `<part> flex-wrap`. On a
 * non-wrapping column, `row-gap` becomes the `gap`. Elsewhere `row-gap` is dropped.
 */
export function mapWrapToLayout(
  contract: FigmaGenerationContract,
  plan: ResolvedComponentPlan,
): ResolvedComponentPlan {
  if (
    !anyGeometry(
      plan,
      (geometry) => geometry.layoutWrap !== undefined || geometry.rowGap !== undefined,
    )
  ) {
    return plan;
  }
  const pass = createLayoutPass(contract, plan);
  const root = contract.rootPart;

  // The root's base geometry is shared by every cell, so a decision for one cell (a refusal where
  // its layout is not horizontal) must not edit it. Push the two keys down into each cell first;
  // every edit below then touches only that cell's own geometry.
  for (const key of ["layoutWrap", "rowGap"] as const) {
    const inherited = pass.baseGeometry[key];
    if (inherited === undefined) continue;
    plan.variantMatrix.forEach((_cell, index) => {
      const own = pass.own(root, index);
      if (own && own[key] === undefined) (own as Record<string, unknown>)[key] = inherited;
    });
    delete pass.baseGeometry[key];
  }

  plan.variantMatrix.forEach((_cell, index) => {
    pass.nodes(index, (node) => {
      const read = pass.read(node.part, index);
      if (read.layoutWrap === undefined && read.rowGap === undefined) return;
      const own = pass.own(node.part, index);
      if (!own) return;
      const clear = (key: keyof ResolvedPlanGeometry) => {
        delete own[key];
      };
      const layout = pass.layoutOf(node, index);
      if (read.layoutWrap !== undefined) {
        if (layout !== "horizontal") {
          clear("layoutWrap");
          pass.refuse(
            node.part,
            "flex-wrap",
            `flex-wrap: wrap — Figma wraps only a horizontal row, and "${node.part}" lays out as ${layout}`,
          );
        } else {
          const lineGap = read.rowGap ?? read.gap;
          if (lineGap !== undefined) own.counterAxisSpacing = lineGap;
        }
      } else if (read.rowGap !== undefined && layout === "vertical") {
        // The cascade has already kept `row-gap` only where no later `gap` reset it, so it is the
        // gap between the column's items, whatever `gap` said for the row axis before it.
        own.gap = read.rowGap;
      }
      clear("rowGap");
      pass.changed = true;
    });
  });
  stripIntermediates(pass, ["rowGap"]);
  return pass.result();
}
