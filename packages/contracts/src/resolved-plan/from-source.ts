import {
  type ExtractComponentRegistryInput,
  extractComponentRegistry,
  withSyntheticAxis,
} from "../registry/extract-registry";
import type { PseudoElementSuffix } from "../registry/resolver";
import type { ComponentRegistryAxis, ResolveAnatomy } from "../registry/types";
import { buildResolvedComponentPlan } from "./from-registry";
import type { FigmaLayoutManifestEntry, ResolvedComponentPlan } from "./types";

export interface ResolvedPlanFromSourceInput extends ExtractComponentRegistryInput {
  /**
   * Synthetic axes with no local union type in source (e.g. Checkbox's `state` /
   * `validity`, Select's `state` — Base UI expresses them via distinct boolean
   * attributes, never a literal `data-state="open"`). Each axis is appended via
   * `withSyntheticAxis` before resolving, in order.
   */
  additionalAxes?: ComponentRegistryAxis[];
  /**
   * The complete axis list, in order, replacing the extracted axes (and ignoring
   * `additionalAxes`). The contract compiler passes a contract's normalized axes here,
   * so a curated source axis (a subset or reordering of its values, another default)
   * and the design-only axes resolve exactly as the contract lists them.
   */
  axes?: ComponentRegistryAxis[];
  layoutManifest?: Record<string, FigmaLayoutManifestEntry>;
  pseudoParts?: Array<{ part: string; hostPart: string; pseudo: PseudoElementSuffix }>;
  /** The contract's anatomy, forwarded to `buildResolvedComponentPlan` (see `ResolveAnatomy`). */
  anatomy?: ResolveAnatomy;
}

/** PURE. `(component source) → ResolvedComponentPlan`, same inputs → byte-identical output. */
export function resolvedPlanFromComponentSource(
  input: ResolvedPlanFromSourceInput,
): ResolvedComponentPlan {
  let entry = extractComponentRegistry(input);
  if (input.axes) {
    entry = { ...entry, axes: input.axes };
  } else {
    for (const axis of input.additionalAxes ?? []) {
      entry = withSyntheticAxis(entry, axis);
    }
  }
  return buildResolvedComponentPlan(entry, {
    layoutManifest: input.layoutManifest,
    pseudoParts: input.pseudoParts,
    anatomy: input.anatomy,
  });
}
