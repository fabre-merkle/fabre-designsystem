/**
 * The focus ring as a layer.
 *
 * A control's focus ring is an `outline` on its root under `:focus-visible`. It changes no layout,
 * so it does not need a State value that multiplies every variant, and a boolean property can
 * only show or hide a layer. `focusRing` closes that gap: the compiler generates an overlay part
 * for the ring, binds its stroke width and colour from the root's own `:focus-visible` outline,
 * and a boolean property (off by default) shows it.
 *
 * - The colour is resolved by the resolver as it resolves every other binding: a copy of the
 *   contract's axes whose State axis holds only `focus-visible` is resolved, so every rule that
 *   applies to a focused root (a variant's own ring colour included) answers per cell.
 * - The width and the offset are read from the `:focus-visible` rule that names the root and
 *   nothing else. The width must be a single token reference; the offset a token, a negated
 *   token (`calc(var(--token) * -1)`) or zero. Any other literal is refused, never used.
 * - A rule that names the root with axis attributes and `:focus-visible` and nothing else
 *   (`[data-ui="tab"][data-variant="segment"]:focus-visible`) may change the offset for the
 *   variants it matches. A rule of any other shape that changes the width or offset is refused.
 * - Figma cannot bind a position or a size to a variable, so the ring's inset (offset plus width)
 *   is the tokens' resolved pixel values, and its corner radius is the focused root's plus that
 *   inset. An inset that differs by variant is recorded per value of the one axis it follows.
 *
 * It also reports the opposite case: a `:focus-visible` outline on the root that nothing in the
 * contract covers, which would otherwise vanish from the generated component without a word.
 */
import {
  parseComponentCss,
  parseCompoundSelector,
  parseSelectorVariants,
  splitCombinators,
  splitTopLevel,
} from "../registry/css-parser";
import {
  cssVarToFigmaVariableName,
  getResolvedTokenPxValues,
  normalizeVariableName,
} from "../registry/resolver";
import { isStandardStateAxis } from "../registry/state-axis";
import type { ResolvedComponentPlan, ResolvedPlanCell } from "../resolved-plan/types";
import { type Diagnostic, diagnostic, diagnosticPath, refusal } from "./diagnostics";
import type {
  FigmaGenerationContract,
  GenerationContractAnatomyNode,
  GenerationContractFocusRing,
  GenerationContractProperty,
} from "./types";

/** The property that shows the ring, unless the contract names another. */
export const FOCUS_RING_PROPERTY = "focus-visible";

/** The generated ring part of a root part: `button` has `button-focus-ring`. */
export function focusRingPart(rootPart: string): string {
  return `${rootPart}-focus-ring`;
}

/** The property name the ring's boolean has. */
export function focusRingPropertyName(ring: GenerationContractFocusRing): string {
  return ring.property ?? FOCUS_RING_PROPERTY;
}

/**
 * The contract with its ring declaration expanded into what generates it: the part, the overlay
 * anatomy node as the root's last child, and the boolean property. A contract that declares no
 * ring, or one already expanded, comes back unchanged.
 */
export function expandFocusRing(contract: FigmaGenerationContract): FigmaGenerationContract {
  const ring = contract.focusRing;
  if (!ring) return contract;
  const part = focusRingPart(contract.rootPart);
  if (contract.parts.includes(part)) return contract;
  if (!contract.anatomy) {
    throw new Error(
      `"${contract.slug}" declares a focus ring, which is a part of the anatomy: declare an anatomy.`,
    );
  }
  const property: GenerationContractProperty = {
    type: "boolean",
    name: focusRingPropertyName(ring),
    part,
    default: false,
  };
  const node: GenerationContractAnatomyNode = {
    part,
    kind: "frame",
    layout: "overlay",
    synthetic: true,
  };
  return {
    ...contract,
    parts: [...contract.parts, part],
    anatomy: { ...contract.anatomy, children: [...(contract.anatomy.children ?? []), node] },
    properties: [...(contract.properties ?? []), property],
    focusRing: { ...ring, part },
  };
}

/** An outline offset: a token (or its negation), or zero. */
export type FocusRingOffset = { variable: string; sign: 1 | -1 } | { zero: true };

/** A `:focus-visible` rule on the root that changes the offset for the variants it matches. */
export interface FocusRingOffsetRule {
  /** The attribute values the rule requires (`data-variant` to `segment`). */
  attributes: Record<string, string>;
  /** The selector's specificity: a more specific rule wins over a later, less specific one. */
  specificity: number;
  offset: FocusRingOffset;
}

/** What the root's `:focus-visible` rules give the ring, as token variables. */
export interface FocusRingMetrics {
  widthVariable: string;
  /** The bare rule's offset. */
  offset: FocusRingOffset;
  /** Rules that change the offset for some variants, in source order. */
  offsetRules: FocusRingOffsetRule[];
}

/** A `var(--name)` that is the whole value, or `undefined`. */
function singleVar(value: string | undefined): string | undefined {
  return /^var\(\s*(--[a-zA-Z0-9-]+)\s*\)$/.exec(value?.trim() ?? "")?.[1];
}

const OUTLINE_STYLES = new Set([
  "none",
  "solid",
  "dashed",
  "dotted",
  "double",
  "groove",
  "ridge",
  "inset",
  "outset",
  "auto",
]);

/** Whether a selector's subject is the root part under `:focus-visible` and nothing else. */
function isBareRootFocus(selector: string, rootPart: string): boolean {
  const compounds = splitCombinators(selector);
  if (compounds.length !== 1) return false;
  const compound = parseCompoundSelector(compounds[0]);
  return (
    compound.type === undefined &&
    compound.attributes.length === 1 &&
    compound.attributes[0].name === "data-ui" &&
    compound.attributes[0].value === rootPart &&
    compound.pseudos.length === 1 &&
    compound.pseudos[0] === ":focus-visible" &&
    !compound.negatedPseudos?.length &&
    !compound.lists?.length
  );
}

/**
 * The attribute values of a selector that names the root under `:focus-visible` with positive
 * `[attribute="value"]` conditions and nothing else, or `undefined` for any other shape.
 */
function rootFocusAttributes(
  selector: string,
  rootPart: string,
): Record<string, string> | undefined {
  const compounds = splitCombinators(selector);
  if (compounds.length !== 1) return undefined;
  const compound = parseCompoundSelector(compounds[0]);
  if (
    compound.type !== undefined ||
    compound.negatedPseudos?.length ||
    compound.lists?.length ||
    compound.pseudos.length !== 1 ||
    compound.pseudos[0] !== ":focus-visible"
  ) {
    return undefined;
  }
  const attributes: Record<string, string> = {};
  let names = false;
  for (const attribute of compound.attributes) {
    if (attribute.negated || attribute.value === null) return undefined;
    if (attribute.name === "data-ui") {
      if (attribute.value !== rootPart) return undefined;
      names = true;
    } else {
      attributes[attribute.name] = attribute.value;
    }
  }
  return names ? attributes : undefined;
}

/** An outline offset value as a token, a negated token or zero; `undefined` for anything else. */
function parseOffset(value: string): FocusRingOffset | undefined {
  const trimmed = value.trim();
  if (/^0(px)?$/.test(trimmed)) return { zero: true };
  const token = singleVar(trimmed);
  if (token) return { variable: cssVarToFigmaVariableName(token), sign: 1 };
  const negated = /^calc\(\s*var\(\s*(--[a-zA-Z0-9-]+)\s*\)\s*\*\s*-1\s*\)$/.exec(trimmed)?.[1];
  if (negated) return { variable: cssVarToFigmaVariableName(negated), sign: -1 };
  return undefined;
}

/** Whether a selector's subject is the root part under `:focus-visible`, with any other condition. */
function isRootFocus(selector: string, rootPart: string): boolean {
  const compounds = splitCombinators(selector);
  const last = compounds.at(-1);
  if (!last) return false;
  const compound = parseCompoundSelector(last);
  return (
    compound.attributes.some(
      (attribute) =>
        !attribute.negated && attribute.name === "data-ui" && attribute.value === rootPart,
    ) && compound.pseudos.includes(":focus-visible")
  );
}

/**
 * The ring's width and offset tokens, read from the `:focus-visible` rule that names the root and
 * nothing else (later declarations win, as in a browser), and the rules that change the offset
 * for some variants. Refuses a root with no such outline, a width that is not a single token, an
 * offset that is not a token, a negated token or zero, and a rule of any other shape that changes
 * the width or the offset.
 */
export function readFocusRingMetrics(
  contract: Pick<FigmaGenerationContract, "slug" | "rootPart">,
  cssSource: string,
): FocusRingMetrics {
  const at = diagnosticPath(contract.slug, ["focusRing"]);
  let width: string | undefined;
  let offset: string | undefined;
  const offsetRules: Array<{
    attributes: Record<string, string>;
    specificity: number;
    value: string;
  }> = [];
  const widthOf = (value: string) => {
    const tokens = splitTopLevel(value, " ")
      .map((token) => token.trim())
      .filter(Boolean);
    const style = tokens.findIndex((token) => OUTLINE_STYLES.has(token));
    return style > 0 ? tokens[style - 1] : tokens[0];
  };
  for (const rule of parseComponentCss(cssSource)) {
    if (rule.media.length > 0) continue;
    const rootSelectors = rule.selectors.filter((selector) =>
      isRootFocus(selector, contract.rootPart),
    );
    if (rootSelectors.length === 0) continue;
    const bare = rule.selectors.some((selector) => isBareRootFocus(selector, contract.rootPart));
    if (bare) {
      for (const { property, value } of rule.declarations) {
        if (property === "outline") width = widthOf(value);
        else if (property === "outline-width") width = value.trim();
        else if (property === "outline-offset") offset = value.trim();
      }
      continue;
    }
    const changesWidth = rule.declarations.some(
      ({ property }) => property === "outline" || property === "outline-width",
    );
    const changedOffset = rule.declarations.findLast(
      ({ property }) => property === "outline-offset",
    );
    if (!changesWidth && !changedOffset) continue;
    const conditions = rootSelectors.map((selector) =>
      rootFocusAttributes(selector, contract.rootPart),
    );
    if (changesWidth || conditions.some((attributes) => attributes === undefined)) {
      throw refusal(
        "focus-ring-invalid",
        `"${contract.slug}" focus ring: \`${rule.selectors.join(", ")}\` changes the outline ${changesWidth ? "width" : "offset"} in a way the ring cannot follow. Only the offset may change per variant, in a rule that names the root, its axis attributes and \`:focus-visible\` and nothing else.`,
        at,
      );
    }
    rootSelectors.forEach((selector, index) => {
      offsetRules.push({
        attributes: conditions[index] ?? {},
        specificity: parseSelectorVariants(selector).specificity,
        value: changedOffset?.value ?? "",
      });
    });
  }
  if (width === undefined || offset === undefined) {
    throw refusal(
      "focus-ring-invalid",
      `"${contract.slug}" declares a focus ring, but the stylesheet has no \`[data-ui="${contract.rootPart}"]:focus-visible\` rule with an outline width and an outline offset.`,
      at,
    );
  }
  const widthVar = singleVar(width);
  const parsedOffset = parseOffset(offset);
  const parsedRules = offsetRules.map((rule) => ({
    attributes: rule.attributes,
    specificity: rule.specificity,
    offset: parseOffset(rule.value),
  }));
  const badRule = offsetRules.find((_, index) => parsedRules[index].offset === undefined);
  if (!widthVar || !parsedOffset || badRule) {
    throw refusal(
      "focus-ring-invalid",
      `"${contract.slug}" focus ring reads \`${width}\` for its width and \`${badRule?.value ?? offset}\` for its offset; the width must be a single \`var(--token)\` and the offset a token, a negated token (\`calc(var(--token) * -1)\`) or 0, because a literal cannot be bound.`,
      at,
    );
  }
  return {
    widthVariable: cssVarToFigmaVariableName(widthVar),
    offset: parsedOffset,
    offsetRules: parsedRules as FocusRingOffsetRule[],
  };
}

/** A token's resolved pixel value, or `undefined` when it is not a known pixel token. */
function tokenPx(variable: string): number | undefined {
  return getResolvedTokenPxValues()?.get(normalizeVariableName(variable));
}

/** An offset's pixel value, or `undefined` when its token has no known pixel value. */
function offsetPx(offset: FocusRingOffset): number | undefined {
  if ("zero" in offset) return 0;
  const px = tokenPx(offset.variable);
  return px === undefined ? undefined : px * offset.sign;
}

/**
 * The ring's inset in pixels for one variant: its offset plus the stroke width. The offset is the
 * one the cascade picks among the rules that match the variant's attribute values (each axis's
 * `attribute` names it): the most specific, then the last in source order, else the bare rule's.
 * `undefined` when the loaded token values do not hold the tokens.
 */
export function focusRingInsetFor(
  metrics: FocusRingMetrics,
  key: Readonly<Record<string, string>>,
  axes: ReadonlyArray<{ prop: string; attribute?: string }>,
): number | undefined {
  const values = new Map(
    axes.flatMap((axis) =>
      axis.attribute && key[axis.prop] !== undefined ? [[axis.attribute, key[axis.prop]]] : [],
    ),
  );
  let rule: FocusRingOffsetRule | undefined;
  for (const candidate of metrics.offsetRules) {
    const matches = Object.entries(candidate.attributes).every(
      ([name, value]) => values.get(name) === value,
    );
    // Source order breaks a tie, so a later rule of equal specificity wins.
    if (matches && (!rule || candidate.specificity >= rule.specificity)) rule = candidate;
  }
  const widthPx = tokenPx(metrics.widthVariable);
  const offset = offsetPx(rule?.offset ?? metrics.offset);
  if (widthPx === undefined || offset === undefined) return undefined;
  return widthPx + offset;
}

/**
 * The ring's inset in pixels when it is the same for every variant (no rule changes the offset),
 * or `undefined` when the loaded token values do not hold the tokens. A compile of the sources
 * alone has no token values: the ring is then generated unplaced, and the plugin reports it.
 */
export function focusRingInset(
  contract: Pick<FigmaGenerationContract, "slug">,
  metrics: FocusRingMetrics,
): number | undefined {
  void contract;
  return focusRingInsetFor({ ...metrics, offsetRules: [] }, {}, []);
}

/**
 * Where the ring sits for every variant: one inset when every variant has the same, or one per
 * value of the single axis it follows (`insetPxByAxis`). Nothing when a token has no known pixel
 * value. Refuses an inset that follows more than one axis.
 */
export function focusRingPlacement(
  contract: Pick<FigmaGenerationContract, "slug" | "axes">,
  metrics: FocusRingMetrics,
): Pick<GenerationContractFocusRing, "insetPx" | "insetPxByAxis"> {
  const keys = contract.axes.reduce<Array<Record<string, string>>>(
    (cells, axis) =>
      cells.flatMap((key) => axis.values.map((value) => ({ ...key, [axis.prop]: value }))),
    [{}],
  );
  const insets = keys.map((key) => focusRingInsetFor(metrics, key, contract.axes));
  if (insets.some((inset) => inset === undefined)) return {};
  if (new Set(insets).size === 1) return { insetPx: insets[0] as number };
  for (const axis of contract.axes) {
    const values: Record<string, number> = {};
    const follows = keys.every((key, index) => {
      const known = values[key[axis.prop]];
      values[key[axis.prop]] = insets[index] as number;
      return known === undefined || known === insets[index];
    });
    if (follows) return { insetPxByAxis: { axis: axis.prop, values } };
  }
  throw refusal(
    "focus-ring-invalid",
    `"${contract.slug}" focus ring offset changes with more than one axis; the ring's inset can follow one axis.`,
    diagnosticPath(contract.slug, ["focusRing"]),
  );
}

/**
 * The contract's axes with the State axis replaced by one that holds only `focus-visible`, so
 * resolving them answers every rule that applies to a focused root, per variant.
 */
export function focusRingAxes<Axis extends { prop: string; values: readonly string[] }>(
  axes: readonly Axis[],
): Array<Axis | Record<string, unknown>> {
  return [
    ...axes.filter((axis) => !isStandardStateAxis(axis)),
    {
      prop: "state",
      values: ["focus-visible"],
      default: "focus-visible",
      attribute: "data-state",
      valueSelectors: { "focus-visible": ":focus-visible" },
    },
  ];
}

/**
 * Adds the ring part's bindings to a resolved plan, index-aligned with its variants: the stroke
 * colour each variant's focused root has, the stroke width token, and a corner radius that follows
 * the root's. `ringPlan` is the same component resolved over `focusRingAxes`.
 */
export function withFocusRingBindings(
  contract: Pick<FigmaGenerationContract, "slug" | "rootPart">,
  plan: ResolvedComponentPlan,
  ringPlan: Pick<ResolvedComponentPlan, "variantMatrix"> &
    Partial<Pick<ResolvedComponentPlan, "baseGeometry">>,
  metrics: FocusRingMetrics,
  /** The ring's inset for a variant (see `focusRingInsetOf`). */
  insetFor: (key: Record<string, string>) => number | undefined,
): ResolvedComponentPlan {
  const at = diagnosticPath(contract.slug, ["focusRing"]);
  const part = focusRingPart(contract.rootPart);
  const ownKey = (key: Record<string, string>) =>
    JSON.stringify(Object.entries(key).filter(([prop]) => prop !== "state"));
  const ringByKey = new Map(ringPlan.variantMatrix.map((cell) => [ownKey(cell.key), cell]));
  const cells = plan.variantMatrix.map((cell): ResolvedPlanCell => {
    const ring = ringByKey.get(ownKey(cell.key));
    if (!ring?.bind.stroke) {
      throw refusal(
        "focus-ring-invalid",
        `"${contract.slug}" focus ring has no outline colour for ${cell.label}: no \`:focus-visible\` rule gives that variant's root an outline-color token.`,
        at,
      );
    }
    // The ring follows the focused root's corners: a `:focus-visible` rule may round them.
    const geometry = {
      ...plan.baseGeometry,
      ...cell.geometry,
      ...focusedRadius({ ...ringPlan.baseGeometry, ...ring.geometry }),
    };
    const radiusVariable = geometry.radius;
    const radiusPx =
      geometry.radiusPx ?? (radiusVariable === undefined ? undefined : tokenPx(radiusVariable));
    const insetPx = insetFor(cell.key);
    return {
      key: cell.key,
      label: cell.label,
      bind: { stroke: ring.bind.stroke },
      geometry: {
        borderWidth: metrics.widthVariable,
        ...(radiusPx === undefined || insetPx === undefined
          ? {}
          : { radiusPx: radiusPx + insetPx }),
      },
    };
  });
  return {
    ...plan,
    parts: plan.parts.includes(part) ? plan.parts : [...plan.parts, part],
    partBindings: { ...plan.partBindings, [part]: cells },
  };
}

/** The corner radius of a focused root's geometry, when it has one. */
function focusedRadius(geometry: ResolvedPlanCell["geometry"]): ResolvedPlanCell["geometry"] {
  if (!geometry) return {};
  if (geometry.radiusPx !== undefined)
    return { radius: geometry.radius, radiusPx: geometry.radiusPx };
  if (geometry.radius !== undefined) return { radius: geometry.radius, radiusPx: undefined };
  return {};
}

/**
 * A warning for a `:focus-visible` outline on the root that nothing covers. It is covered by a
 * focus ring declaration or by an axis value whose selector is `:focus-visible`; otherwise the
 * outline is a rule that applies in a browser and in no variant, and so is gone from the Figma
 * component.
 */
export function focusRingDroppedWarning(
  contract: {
    slug: string;
    rootPart: string;
    axes?: ReadonlyArray<{ valueSelectors?: Record<string, string | null> }>;
    focusRing?: unknown;
  },
  cssSource: string,
): Diagnostic | undefined {
  if (contract.focusRing) return undefined;
  const covered = (contract.axes ?? []).some((axis) =>
    Object.values(axis.valueSelectors ?? {}).some((selector) =>
      selector?.includes(":focus-visible"),
    ),
  );
  if (covered) return undefined;
  const rule = parseComponentCss(cssSource).find(
    (candidate) =>
      candidate.declarations.some(
        ({ property }) => property === "outline" || property === "outline-color",
      ) && candidate.selectors.some((selector) => isRootFocus(selector, contract.rootPart)),
  );
  if (!rule) return undefined;
  return diagnostic(
    "focus-ring-dropped",
    `"${contract.rootPart}" has a \`:focus-visible\` outline (\`${rule.selectors[0]}\`) that no State value and no \`focusRing\` declaration covers, so the generated component has no focus ring.`,
    diagnosticPath(contract.slug, ["focusRing"]),
  );
}
