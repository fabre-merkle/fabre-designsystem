/**
 * Percentage insets as `constraints: SCALE`.
 *
 * A box positioned `absolute` with percentage insets (`top: 50%`, `left: 25%`) sits at a fraction
 * of its container and keeps that fraction when the container resizes: Figma's SCALE constraint,
 * which exists only on a child of a NON-auto-layout frame. So an absolutely positioned child of an
 * overlay parent gets `constraints` SCALE on each axis whose insets are percentages.
 *
 * Under an auto-layout parent the same CSS has no exact equivalent (`removeFromFlow` anchors to an
 * edge or the centre, never to a fraction), so it is refused and reported under `<part> inset`.
 * The root has no parent frame to scale against: where the page puts it (a dialog centred in the
 * window) is the viewport stand-in's business, so a root inset states nothing here and is dropped. `insetPercent` stays in the compiled plan only beside the
 * `constraints` it positions (the walker places the child at that fraction); it is dropped
 * everywhere else.
 */
import type { ResolvedComponentPlan, ResolvedPlanGeometry } from "../resolved-plan/types";
import { anyGeometry, createLayoutPass } from "./layout-pass";
import type { FigmaGenerationContract } from "./types";

/**
 * Maps percentage insets on an overlay child to scale constraints, and refuses them (under `<part>
 * inset`) under an auto-layout parent.
 */
export function mapInsetsToConstraints(
  contract: FigmaGenerationContract,
  plan: ResolvedComponentPlan,
): ResolvedComponentPlan {
  if (!anyGeometry(plan, (geometry) => geometry.insetPercent !== undefined)) return plan;
  const pass = createLayoutPass(contract, plan);
  const reported = new Set<string>();

  plan.variantMatrix.forEach((_cell, index) => {
    pass.edges(index, (parent, child) => {
      const inset = pass.read(child.part, index).insetPercent;
      if (!inset) return;
      const horizontal = inset.left !== undefined || inset.right !== undefined;
      const vertical = inset.top !== undefined || inset.bottom !== undefined;
      if (pass.layoutOf(parent, index) !== "overlay") {
        if (!reported.has(child.part)) {
          reported.add(child.part);
          pass.refuse(
            child.part,
            "inset",
            `percentage inset (${Object.entries(inset)
              .map(([side, value]) => `${side}: ${value}%`)
              .join(
                ", ",
              )}) — "${parent.part}" is an auto-layout frame, whose children are anchored to ` +
              "an edge or the centre, never to a fraction of the frame",
          );
        }
        return;
      }
      const own = pass.own(child.part, index);
      if (!own) return;
      own.constraints = {
        ...(horizontal ? { horizontal: "SCALE" as const } : {}),
        ...(vertical ? { vertical: "SCALE" as const } : {}),
      };
    });
  });
  // The percentages stay only beside the constraints they position; elsewhere they are dropped.
  const strip = (geometry: ResolvedPlanGeometry | undefined) => {
    if (geometry && !geometry.constraints) delete geometry.insetPercent;
  };
  strip(pass.baseGeometry);
  for (const cell of pass.variantMatrix) strip(cell.geometry);
  for (const cells of Object.values(pass.partBindings))
    for (const cell of cells) strip(cell.geometry);
  pass.changed = true;
  return pass.result();
}
