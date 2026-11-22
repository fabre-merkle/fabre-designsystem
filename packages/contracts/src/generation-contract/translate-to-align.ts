/**
 * A `translateX` to the end edge as the parent's `primaryAxisAlignItems: "MAX"`.
 *
 * Switch draws its thumb at the start of the track and, when checked, shifts it with
 * `transform: translateX(calc(<track width> - <track height>))`: the distance to the track's end
 * edge. Figma has no transform on an auto-layout child and a literal offset would be a guess, but
 * it has the same idea natively: the track's main-axis alignment. The thumb stays a flow child and
 * the track aligns it to MIN (unchecked) or MAX (checked).
 *
 * The mapping is made only when it is exact, checked in the CSS box model against the tokens in
 * force: the translated part is the parent's only in-flow child (an alignment moves every child),
 * the parent lays out as a horizontal row that starts at MIN, and the translation equals the room
 * the child has left between the parent's padding and border (`inner width - child width`). A
 * translation that is anything else, or one whose operands cannot be measured (no token values
 * injected, an unsized box), is refused and reported under `<part> transform`. The `translateXPx`
 * intermediate never reaches a compiled plan.
 */
import { parseComponentCss } from "../registry/css-parser";
import {
  cssVarToFigmaVariableName,
  getResolvedTokenPxValues,
  normalizeVariableName,
} from "../registry/resolver";
import type {
  ResolvedComponentPlan,
  ResolvedDimension,
  ResolvedPlanGeometry,
} from "../resolved-plan/types";
import { anyGeometry, createLayoutPass, stripIntermediates } from "./layout-pass";
import type { FigmaGenerationContract } from "./types";

const EPSILON = 0.01;

/** The pixel value of a size token, or `undefined` when it is unknown. */
const tokenPx = (variable: string | undefined): number | undefined =>
  variable === undefined
    ? undefined
    : getResolvedTokenPxValues()?.get(normalizeVariableName(variable));

/**
 * The pixel size of a literal or token-bound dimension, or `undefined` when it cannot be measured.
 */
function dimensionPx(dimension: ResolvedDimension | undefined): number | undefined {
  if (dimension?.kind === "literal") return dimension.px;
  if (dimension?.kind === "variable") return tokenPx(dimension.variable);
  return undefined;
}

/** A padding side in px (`0` when the part sets none), or `undefined` when its token is unknown. */
function paddingPx(side: string | undefined, symmetric: string | undefined): number | undefined {
  const variable = side ?? symmetric;
  return variable === undefined ? 0 : tokenPx(variable);
}

/**
 * The part's own unconditional `border` shorthand width: the token it names, `undefined` when the
 * part declares no border (or `none`/`0`), and `null` when it declares one this pass cannot
 * measure (a px literal, an expression). The plan binds a border width only for a drawn stroke, but
 * a transparent border still insets the content, so the box is measured from the CSS itself. State
 * variants are not consulted (a border's width does not change by state in this design system; only
 * its colour does).
 */
function borderShorthandWidth(cssSource: string, part: string): string | null | undefined {
  const selector = `[data-ui="${part}"]`;
  let value: string | undefined;
  for (const rule of parseComponentCss(cssSource)) {
    if (rule.media.length > 0 || !rule.selectors.includes(selector)) continue;
    for (const declaration of rule.declarations) {
      if (declaration.property === "border") value = declaration.value.trim();
    }
  }
  if (value === undefined || value === "none" || /^0(?:px)?\b/.test(value)) return undefined;
  const widthToken = /^var\(\s*(--[a-zA-Z0-9-]+)\s*\)/.exec(value);
  return widthToken && !/^--color/.test(widthToken[1])
    ? cssVarToFigmaVariableName(widthToken[1])
    : null;
}

/** The parent's border widths on the two horizontal sides, in px (`undefined`: not measurable). */
function horizontalBorderPx(
  geometry: ResolvedPlanGeometry,
  shorthand: string | null | undefined,
): number | undefined {
  const sided = [
    geometry.borderTopWidth,
    geometry.borderRightWidth,
    geometry.borderBottomWidth,
    geometry.borderLeftWidth,
  ].some((value) => value !== undefined);
  if (shorthand === null && geometry.borderWidth === undefined && !sided) return undefined;
  const allSides = geometry.borderWidth ?? shorthand ?? undefined;
  const side = (own: string | undefined) => own ?? (sided ? undefined : allSides);
  const widthOf = (variable: string | undefined) =>
    variable === undefined ? 0 : tokenPx(variable);
  const l = widthOf(side(geometry.borderLeftWidth));
  const r = widthOf(side(geometry.borderRightWidth));
  return l === undefined || r === undefined ? undefined : l + r;
}

/**
 * Maps a `translateX` to the end edge onto the parent's main-axis alignment when that is exact;
 * otherwise refuses it under `<part> transform`.
 */
export function mapTranslateToAlign(
  contract: FigmaGenerationContract,
  plan: ResolvedComponentPlan,
  cssSource: string,
): ResolvedComponentPlan {
  if (!anyGeometry(plan, (geometry) => geometry.translateXPx !== undefined)) return plan;
  const pass = createLayoutPass(contract, plan);
  const root = contract.rootPart;

  plan.variantMatrix.forEach((_cell, index) => {
    // Children of each parent, in flow, for this cell.
    const inFlow = new Map<string, string[]>();
    pass.edges(index, (parent, child, removed) => {
      if (removed) return;
      inFlow.set(parent.part, [...(inFlow.get(parent.part) ?? []), child.part]);
    });

    pass.edges(index, (parent, child) => {
      const translate = pass.read(child.part, index).translateXPx;
      if (translate === undefined) return;
      const refuse = (why: string) =>
        pass.refuse(child.part, "transform", `translateX: ${translate}px — ${why}`);
      if (pass.layoutOf(parent, index) !== "horizontal") {
        return refuse(
          `"${parent.part}" is not a horizontal row, so it has no end edge to align to`,
        );
      }
      const siblings = inFlow.get(parent.part) ?? [];
      if (siblings.length !== 1 || siblings[0] !== child.part) {
        return refuse(
          `the parent's alignment would also move ${siblings
            .filter((part) => part !== child.part)
            .map((part) => `"${part}"`)
            .join(", ")}`,
        );
      }
      const parentGeometry = pass.read(parent.part, index);
      const align = parentGeometry.primaryAxisAlignItems;
      if (align !== undefined && align !== "MIN") {
        return refuse(`"${parent.part}" already aligns its content (${align})`);
      }
      const parentWidth = dimensionPx(parentGeometry.width);
      const childWidth = dimensionPx(pass.read(child.part, index).width);
      const left = paddingPx(parentGeometry.paddingLeft, parentGeometry.paddingInline);
      const right = paddingPx(parentGeometry.paddingRight, parentGeometry.paddingInline);
      const border = horizontalBorderPx(
        parentGeometry,
        borderShorthandWidth(cssSource, parent.part),
      );
      if (
        parentWidth === undefined ||
        childWidth === undefined ||
        left === undefined ||
        right === undefined ||
        border === undefined
      ) {
        return refuse(
          "the box it moves in cannot be measured (an unsized part, or no token values to check against)",
        );
      }
      const room = parentWidth - left - right - border - childWidth;
      if (Math.abs(translate - room) > EPSILON) {
        return refuse(
          `it moves ${translate}px, but the room left to the end edge of "${parent.part}" is ${room}px`,
        );
      }
      const own = pass.own(parent.part, index);
      if (own) {
        own.primaryAxisAlignItems = "MAX";
        if (parent.part === root) pass.changed = true;
      }
    });
  });
  stripIntermediates(pass, ["translateXPx"]);
  return pass.result();
}
