export const COMPONENT_REGISTRY_SCHEMA_VERSION = 1 as const;

export interface ComponentRegistryAxis {
  /** Prop name as it appears in the component API, e.g. "variant", "mode", "size". */
  prop: string;
  /** The full literal union of values found in source — NOT curated. */
  values: string[];
  /** The default value (first declared in the source union). */
  default: string;
  attribute: string;
  valueSelectors?: Record<string, string | null>;
  partValueSelectors?: Record<string, Record<string, string | null>>;

  /**
   * Set when the runtime OMITS `attribute` entirely for the value whose
   * `valueSelectors` entry is `null` (e.g. drawer's `data-side`, which only
   * appears for non-default sides). It lets a valueless `:not([attribute])` /
   * `[attribute]` selector be evaluated per cell: the attribute is absent for
   * the null-selector value and present for every other value. Leave unset
   * for an always-present attribute (Base UI's `data-orientation`) whose null
   * value only means "no extra constraint" — there the valueless form stays
   * unresolved.
   */
  attributeOmittedWhenNull?: boolean;

  /**
   * Code props that a value of a design-only axis stands for, keyed by axis value. Code Connect
   * renders `{ prop, value }` when the Figma component has that value, for example
   * `content: { "icon-only": { prop: "iconOnly", value: true } }`. A value with no entry sets
   * nothing, so the component's own default applies. Declared, never inferred.
   */
  codeProps?: Record<string, { prop: string; value: string | boolean }>;

  /**
   * Source values this axis does not offer as Figma variants, and the combination of the
   * contract's other axes each one folds into. Keyed by a source value that is NOT in the
   * curated `values`; the entry names other axes (prop to value) that together express it. Example:
   * Button's `size="icon-sm"` is `{ content: "icon-only", size: "sm" }` in Figma. The fold is
   * recorded, never applied to the matrix; it lets a consumer such as Code Connect map the Figma
   * properties back to the code value.
   */
  foldedValues?: Record<string, Record<string, string>>;
}

/** One CSS rule as extracted verbatim from the component's stylesheet (unfiltered). */
export interface ComponentRegistryCssRule {
  selectors: string[];
  declarations: Array<{ property: string; value: string }>;
  media: string[];
}

export interface ComponentRegistryEntry {
  schemaVersion: typeof COMPONENT_REGISTRY_SCHEMA_VERSION;
  /** Component name, e.g. "Button". */
  name: string;
  /** Repo-relative source path (component + stylesheet), for provenance. */
  source: { component: string; stylesheet: string };
  /**
   * The primary `data-ui` value that carries this component's variant/mode/size/
   * state styling — the root the resolver matches against for fill/text/stroke.
   * (`"button"` for Button; `"select-trigger"` for Select — the sub-part that
   * actually owns the trigger's colour + geometry rules.)
   */
  rootPart: string;
  /**
   * Set while one sub-part is resolved on its own (that part is then `rootPart`): the component's
   * real root. Absent on an entry that is resolved as the component itself.
   */
  componentRoot?: string;
  /** Sub-part `data-ui` names found in the component (compound components only). */
  parts: string[];
  /** Variant axes — auto-derived from local union types, full (uncurated) union. */
  axes: ComponentRegistryAxis[];
  /** Every CSS rule extracted from the component's co-located stylesheet. */
  cssRules: ComponentRegistryCssRule[];
}

/** The part of a contract's anatomy node the resolver reads (a `GenerationContractAnatomyNode` satisfies it). */
export interface AnatomyNodeLike {
  part: string;
  /** A contract-only layout wrapper with no element of its own. */
  synthetic?: boolean;
  /** Renders only in the cells whose axis values match. */
  when?: Record<string, string | string[]>;
  /** Does not render in the cells whose axis values match. */
  unless?: Record<string, string | string[]>;
  children?: AnatomyNodeLike[];
}

/**
 * What the resolver knows of a component's rendered structure when a contract supplies it: the
 * anatomy tree, the parts the contract declares and the parts it leaves out. Without it the
 * resolver cannot evaluate `:has()` or position pseudo-classes and leaves those rules unapplied.
 */
export interface ResolveAnatomy {
  root: AnatomyNodeLike;
  /** Every part the contract declares. */
  modelled: readonly string[];
  /** Parts the component renders that the contract omits. */
  omitted: readonly string[];
}
