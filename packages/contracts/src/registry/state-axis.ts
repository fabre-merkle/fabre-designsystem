/**
 * The standard State axis.
 *
 * A component's pointer, keyboard and availability states are one axis, `state`, with the values
 * `default`, `hover`, `active`, `focus-visible` and `disabled` (the ones the component's CSS defines).
 * Each value names the selector that expresses it in the component's own CSS (`valueSelectors`),
 * so the stylesheet needs no change.
 *
 * Because the axis holds one value per cell, a cell also knows what it is NOT: a hover cell is not
 * focused, disabled or pressed. That lets the resolver answer a state pseudo-class or attribute,
 * positive or inside `:not()`, for the cell, which it cannot do for separate two-value axes that
 * leave the other states undecided.
 *
 * Dependency-free: this module ships inside the scaffolded compiler bundle.
 */

/** The property name of the standard State axis. */
export const STATE_AXIS_PROP = "state";

/** The standard State values, in the order Figma lists them. */
export const STATE_VALUES = ["default", "hover", "active", "focus-visible", "disabled"] as const;

export type StateValue = (typeof STATE_VALUES)[number];

/** What a state selector tests: the four conditions a cell can be in. */
type StateFacet = "hover" | "pressed" | "focus" | "disabled";

/** The facet each well-known state selector tests. */
const FACET_OF_SELECTOR: Readonly<Record<string, StateFacet>> = {
  ":hover": "hover",
  ":active": "pressed",
  ":focus": "focus",
  ":focus-visible": "focus",
  ":focus-within": "focus",
  ":disabled": "disabled",
  "[disabled]": "disabled",
  "[data-disabled]": "disabled",
  '[aria-disabled="true"]': "disabled",
};

/**
 * The facets true in each state. active is a pointer press, so the pointer is over the element
 * too: a rule written for `:hover` still applies there, and the rule for `:active` wins by
 * specificity or source order exactly as in a browser. focus-visible is keyboard focus, which has no
 * pointer over it. A selector the axis maps to a value is read exactly (`:focus-within` is the
 * focus-visible cell of one component and `:focus-visible` of another); the facets answer only what
 * a cell is not.
 */
const FACETS_OF_STATE: Readonly<Record<StateValue, ReadonlySet<StateFacet>>> = {
  default: new Set(),
  hover: new Set<StateFacet>(["hover"]),
  active: new Set<StateFacet>(["hover", "pressed"]),
  "focus-visible": new Set<StateFacet>(["focus"]),
  disabled: new Set<StateFacet>(["disabled"]),
};

function isStateValue(value: string): value is StateValue {
  return (STATE_VALUES as readonly string[]).includes(value);
}

/** Whether an axis is the standard State axis: the `state` property with only standard values. */
export function isStandardStateAxis(axis: { prop: string; values: readonly string[] }): boolean {
  return axis.prop === STATE_AXIS_PROP && axis.values.length > 0 && axis.values.every(isStateValue);
}

/** Whether a selector fragment (a pseudo-class or attribute selector) tests a state. */
export function isStateSelector(selector: string): boolean {
  return selector.trim().toLowerCase() in FACET_OF_SELECTOR;
}

/**
 * Whether a state selector holds in a cell with this State value, judged by what the selector
 * tests alone: `true`, `false`, or `undefined` when the selector does not test a state, or the
 * value is not a standard one. This answers a negation, `:not(:focus-visible)`, for any component:
 * a hover cell is not focused, whatever the component writes for its focus selector.
 */
export function stateFacetHolds(state: string, selector: string): boolean | undefined {
  const facet = FACET_OF_SELECTOR[selector.trim().toLowerCase()];
  if (facet === undefined || !isStateValue(state)) return undefined;
  return FACETS_OF_STATE[state].has(facet);
}

/**
 * Whether the selector a State value maps to holds in a cell: in that value's own cell, and in a
 * active cell for the hover selector, because a press happens with the pointer over the element.
 */
export function stateValueHolds(state: string, value: string): boolean {
  return state === value || (state === "active" && value === "hover");
}

/**
 * Whether an unmapped spelling of "disabled" (`:disabled`, `[disabled]`, `[data-disabled]`)
 * holds: it does in the disabled cell and nowhere else. `undefined` for any other selector.
 */
export function stateDisabledAliasHolds(state: string, selector: string): boolean | undefined {
  return FACET_OF_SELECTOR[selector.trim().toLowerCase()] === "disabled"
    ? state === "disabled"
    : undefined;
}

/** `@media` conditions that only describe a device with a hovering pointer. */
const HOVER_MEDIA_RE = /hover\s*:\s*hover/i;

/**
 * Whether every `@media` condition around a rule lets it apply. A component that has a State
 * axis designs for a pointer that can hover, so `(hover: hover)` holds and the rule's own
 * selectors decide which State cells it reaches. Without a State axis such a rule is an
 * interaction-only override and is skipped.
 */
export function mediaConditionsHold(media: readonly string[], hasStateAxis: boolean): boolean {
  return hasStateAxis || !media.some((condition) => HOVER_MEDIA_RE.test(condition));
}
