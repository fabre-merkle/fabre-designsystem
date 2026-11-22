/**
 * The plan-layer passes that resolve CSS layout intents the resolver can only record against the
 * part itself: an item filling its padded track, wrapping, a translation to the end edge, and
 * percentage insets. Each needs the anatomy (who is whose parent) and either maps the intent to an
 * ordinary Figma auto-layout property or refuses it in `refusedMargins`, never approximating.
 */
import type { ResolvedComponentPlan } from "../resolved-plan/types";
import { mapInsetCalcToFill } from "./fill-inset";
import { mapInsetsToConstraints } from "./inset-constraints";
import { anyGeometry, createLayoutPass, stripIntermediates } from "./layout-pass";
import { mapTranslateToAlign } from "./translate-to-align";
import type { FigmaGenerationContract } from "./types";
import { mapWrapToLayout } from "./wrap-to-layout";

/** Intermediates no compiled plan may carry, whatever part or pass they were left on. */
const LEFTOVER_INTERMEDIATES = ["rowGap", "translateXPx"] as const;

/**
 * Runs the plan-layer layout passes in order (fill inset, wrap, translate, percentage insets) and
 * returns the plan with intermediates removed.
 */
export function mapLayoutIntents(
  contract: FigmaGenerationContract,
  plan: ResolvedComponentPlan,
  cssSource: string,
): ResolvedComponentPlan {
  const mapped = mapInsetsToConstraints(
    contract,
    mapTranslateToAlign(
      contract,
      mapWrapToLayout(contract, mapInsetCalcToFill(contract, plan)),
      cssSource,
    ),
  );
  if (!anyGeometry(mapped, (g) => LEFTOVER_INTERMEDIATES.some((key) => g[key] !== undefined))) {
    return mapped;
  }
  const pass = createLayoutPass(contract, mapped);
  stripIntermediates(pass, LEFTOVER_INTERMEDIATES);
  return pass.result();
}
