import type { DimensionInset, ResolvedDimension } from "../resolved-plan/types";
import {
  fragmentValueSets,
  partOf,
  type RenderedNode,
  renderedTree,
  type StructureContext,
  structuralPseudosHold,
} from "./anatomy-match";
import {
  type CssDeclaration,
  type CssRule,
  type ParsedCompoundSelector,
  parseSelectorCompounds,
  parseSelectorVariants,
  parseStructuralPseudo,
  splitTopLevel,
} from "./css-parser";
import {
  isStandardStateAxis,
  mediaConditionsHold,
  stateDisabledAliasHolds,
  stateFacetHolds,
  stateValueHolds,
} from "./state-axis";
import type { ComponentRegistryAxis, ComponentRegistryEntry, ResolveAnatomy } from "./types";

export type { ResolvedDimension };

export interface ResolvedVariantBinding {
  fill?: string;
  /** The fill's strength as a fraction, when the CSS mixes it with `transparent`. */
  fillOpacity?: number;
  text?: string;
  stroke?: string;
  /** The stroke's strength as a fraction, when the CSS mixes it with `transparent`. */
  strokeOpacity?: number;
  effectStyle?: string;
  /**
   * The stroke is `currentColor` (an SVG `stroke: currentColor`): it follows the part's text
   * colour, which may be inherited from an ancestor, so it cannot be bound here. A later
   * `stroke` declaration with a variable clears it. Consumers draw the stroke in the node's
   * resolved text colour.
   */
  strokeFromText?: true;
}

export interface ResolvedGeometry {
  paddingInline?: string;
  paddingBlock?: string;
  /**
   * One-sided padding, present ONLY for a side whose value differs from the opposite
   * side (`padding: A B C D`, `padding-top`, `padding-block-end`, …). A symmetric
   * axis is always `paddingInline`/`paddingBlock`; `setPaddingSides` keeps the two
   * forms mutually exclusive per axis so the cascade (later declaration wins, per
   * side) stays exact. Physical names because the plan is LTR (see the logical-size
   * note on `GEOMETRY_PROPERTIES`).
   */
  paddingLeft?: string;
  paddingRight?: string;
  paddingTop?: string;
  paddingBottom?: string;
  gap?: string;
  radius?: string;
  borderWidth?: string;
  /**
   * One-sided stroke weight (`border-bottom`, `border-inline-start`, ...), the bound
   * width variable of that side. Present only for a side that has a border; a side
   * without one is absent and the walker gives it weight 0 (Figma strokes every
   * side unless told otherwise). Physical names because the plan is LTR.
   */
  borderTopWidth?: string;
  borderRightWidth?: string;
  borderBottomWidth?: string;
  borderLeftWidth?: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  lineHeight?: string;
  letterSpacing?: string;
  textStyle?: string;
  /**
   * Node opacity, from `opacity: var(--opacity-*)`. This is what makes a disabled
   * state visually distinct — without it a `[data-disabled]` cell resolves byte-
   * identical to its enabled twin and the whole availability axis is a no-op.
   */
  opacity?: string;
  /**
   * The node's box on each axis, from `width`/`height`/`inline-size`/`block-size`.
   * Kept as a SHAPE, not a variable name: `100%` and `16px` are real sizes that no
   * variable can express, and `75%` has no Figma equivalent at all — see
   * `ResolvedDimension`.
   */
  width?: ResolvedDimension;
  height?: ResolvedDimension;
  /**
   * `flex-grow` (directly, or via the `flex` shorthand) on a flex CHILD: "take
   * the free space on my parent's main axis", which is exactly Figma's
   * `layoutSizing* = "FILL"`.
   *
   * Carried as a parent-relative INTENT rather than a `width`/`height`, because
   * which axis it means depends on the parent's `flex-direction` and this
   * resolver only ever sees one part at a time. The anatomy walk resolves it —
   * it is the only place that knows a node's parent.
   *
   * Before this existed, `flex: 1 1 auto` produced NO dimension at all, so the
   * node fell through to Figma's 100px default frame: a Slider's track rendered
   * 100px wide inside a 292px control, and read as "the track does not fill".
   */
  growsOnMainAxis?: boolean;
  minWidth?: string;
  maxWidth?: string;
  minHeight?: string;
  maxHeight?: string;
  minWidthPx?: number;
  maxWidthPx?: number;
  minHeightPx?: number;
  maxHeightPx?: number;
  /** `overflow: hidden | clip` → `clipsContent` (see `applyOverflowDeclaration`). */
  clipsContent?: true;
  /** `flex-wrap: wrap`; kept only on a horizontal row by `wrap-to-layout.ts`. */
  layoutWrap?: "WRAP";
  /** Figma's `counterAxisSpacing`; written by `wrap-to-layout.ts`, never by the resolver. */
  counterAxisSpacing?: string;
  /** `row-gap` as a bound variable; an intermediate for `wrap-to-layout.ts`. */
  rowGap?: string;
  /** `transform: translateX()` in px; an intermediate for `translate-to-align.ts`. */
  translateXPx?: number;
  /** `position: absolute` percentage insets; an intermediate for `inset-constraints.ts`. */
  insetPercent?: { top?: number; right?: number; bottom?: number; left?: number };
  /** Written by `inset-constraints.ts`, never by the resolver. */
  constraints?: { horizontal?: "SCALE"; vertical?: "SCALE" };
  layoutMode?: "HORIZONTAL" | "VERTICAL";
  /**
   * `justify-content` (the primary/main axis) mapped to Figma's
   * `primaryAxisAlignItems`. CSS's `space-around`/`space-evenly` have no Figma
   * equivalent and are refused rather than approximated as `SPACE_BETWEEN`.
   */
  primaryAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
  /**
   * `align-items` (the counter/cross axis) mapped to Figma's
   * `counterAxisAlignItems`. Figma's API has no `STRETCH` member on this
   * container-level property (a child stretches via its own `layoutAlign`, which
   * this resolver doesn't reach), so CSS's `stretch` folds to `MIN` here — see
   * `alignItems` immediately below for how `stretch` is still expressed, just not
   * through this enum. `baseline` and anything else unrecognised is refused.
   */
  counterAxisAlignItems?: "MIN" | "CENTER" | "MAX";
  alignItems?: "stretch";
  /**
   * `align-self` on a flex CHILD (`flex-start`/`start`, `center`, `flex-end`/`end`): where the node
   * sits on its parent's cross axis. The plan layer resolves it to the parent's
   * `counterAxisAlignItems` (or refuses it); Figma deprecates a per-child `layoutAlign` for this.
   * Parent-relative, so it applies only once the node has an auto-layout parent. `stretch` and
   * the rest are not carried here (a stretch child fills via sizing).
   */
  alignSelf?: "MIN" | "CENTER" | "MAX";
  /**
   * Margins, per side, as bound variable names (`margin`, `margin-block-start`, ...). Figma has no
   * margin, so the plan layer (`margins-to-layout.ts`) maps each one to the parent's padding or gap
   * when that is exact, and otherwise refuses it and reports it in `refusedMargins`; it is never
   * wrapped in a frame. Present only for a side with a bindable, non-zero, non-negative margin; `0`
   * clears a side, and `auto`, negative or unbindable values are refused and reported
   * (`ResolveVariantBindingsResult.refusedMargins`).
   */
  marginTop?: string;
  marginRight?: string;
  marginBottom?: string;
  marginLeft?: string;
  /**
   * `text-align` mapped to Figma's `textAlignHorizontal`. `start`/`end` assume LTR
   * in a horizontal writing mode — the same documented assumption as the logical
   * size properties above. Anything else (`match-parent`, `justify-all`, …) is
   * refused.
   */
  textAlignHorizontal?: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
  /**
   * `text-transform` mapped to Figma's `textCase`. A Figma enum, not a variable: the
   * composite text style carries no case, so an eyebrow's `uppercase` is lost without it
   * and its tracking, tuned for capitals, reads as far too wide on lowercase glyphs.
   * `capitalize` (CSS keeps each word's other letters as written; Figma's title case does
   * not promise that), `full-width`, `full-size-kana` and anything else are refused (left unset).
   */
  textCase?: "UPPER" | "LOWER" | "ORIGINAL";
  radiusPx?: number;
}

export interface ResolvedVariantCell {
  key: Record<string, string>;
  bind: ResolvedVariantBinding;
  geometry: ResolvedGeometry;
}

/**
 * A pseudo selector may apply only when an explicit display-state axis maps to
 * that exact selector. Positional and structural pseudos require DOM
 * information the resolver does not receive, so accepting them would bind an
 * unverified state to every cell.
 */
function pseudoMatchesAxis(
  pseudo: string,
  fragmentIndex: AxisFragmentMap,
  key: Record<string, string>,
): boolean {
  const match = fragmentIndex.get(pseudo);
  return Boolean(match && fragmentHolds(match, key));
}

/** `@media` conditions that only ever wrap interaction-only overrides (never a bindable base state). */
const INTERACTIVE_MEDIA_RE = /hover\s*:\s*hover/i;

export function normalizeVariableName(name: string): string {
  return name.replace(/[-/_]/g, "").toLowerCase();
}

/**
 * Optional lookup populated by `setKnownVariableMap()` — maps a normalised key
 * (all `-/_` stripped, lowercased) to the actual Figma variable name as it
 * appears in the file (e.g. `"colorcontrolborderhover"` → `"color/control/border-hover"`).
 * When set, `cssVarToFigmaVariableName` resolves against it so the contract
 * artifact stores names the plugin can actually bind, rather than the heuristic
 * approximation that the old single-hyphen substitution produced.
 */
let _knownVariableMap: Map<string, string> | undefined;

/**
 * Inject the normalised→actual variable name map built from the Figma variables
 * snapshot. Call once before `buildGenerationContractArtifact` in build scripts.
 */
export function setKnownVariableMap(map: Map<string, string> | undefined): void {
  _knownVariableMap = map;
}

let _projectTokenNames: ReadonlySet<string> | undefined;

/** Inject the project's DTCG token names. Call once in build scripts, before resolving. */
export function setProjectTokenNames(names: Iterable<string> | undefined): void {
  _projectTokenNames = names
    ? new Set([...names].map((name) => normalizeVariableName(name)))
    : undefined;
}

/**
 * Dimensions Base UI writes onto the element at runtime (`--accordion-panel-height`,
 * `--active-tab-width`, …). They are CSS facts measured from rendered content, never
 * design tokens, so they are refused at build time even when NO project token set was
 * injected. A scaffolded project's compiler has no DTCG to read (the permissive default
 * below); without this list it recorded them as variable bindings no shipped token
 * defines, and every run produced per-node refusals for them. A refused dimension is
 * then resolved by the reviewed layout manifest (hug content), exactly as in the
 * generator's own build.
 */
const BASE_UI_RUNTIME_VARIABLES: ReadonlySet<string> = new Set([
  "--accordion-panel-height",
  "--accordion-panel-width",
  "--active-tab-height",
  "--active-tab-width",
  "--anchor-height",
  "--anchor-width",
  "--available-height",
  "--available-width",
  "--collapsible-panel-height",
  "--collapsible-panel-width",
  "--transform-origin",
]);

/**
 * `false` for a Base UI runtime dimension, and for any name absent from the injected
 * project token set. With no token set injected, every other reference is a token.
 *
 * The runtime list is matched against the ORIGINAL CSS custom-property identifier
 * (`cssName`, exact, before any separator/case folding), so a real token whose folded
 * Figma name merely equals a runtime name is never mis-refused. Callers that only hold
 * a Figma name omit `cssName` and get the token-set check alone.
 */
function isProjectToken(variable: string, cssName?: string): boolean {
  if (cssName !== undefined) {
    const identifier = cssName.startsWith("--") ? cssName : `--${cssName}`;
    if (BASE_UI_RUNTIME_VARIABLES.has(identifier)) return false;
  }
  return !_projectTokenNames || _projectTokenNames.has(normalizeVariableName(variable));
}

/** Exported form of the project-token check, for build-time validators outside the resolver. */
export function isProjectTokenName(variable: string): boolean {
  return isProjectToken(variable);
}

/** Convert a CSS custom-property name to its Figma variable name.
 *
 * When a `knownVariableMap` has been injected via `setKnownVariableMap`, the
 * heuristic name is looked up in that map (via `normalizeVariableName`) and the
 * actual Figma name is returned — so `--color-control-border-hover` resolves to
 * `color/control/border-hover` rather than the heuristic `color/control-border-hover`.
 *
 * Falls back to the original single-hyphen substitution (`--color-x-y` →
 * `color/x-y`) when the map is absent or the name has no entry.
 */
export function cssVarToFigmaVariableName(varName: string): string {
  const stripped = varName.replace(/^--/, "");
  const idx = stripped.indexOf("-");
  const heuristic = idx === -1 ? stripped : `${stripped.slice(0, idx)}/${stripped.slice(idx + 1)}`;
  if (_knownVariableMap) {
    const actual = _knownVariableMap.get(normalizeVariableName(heuristic));
    if (actual) return actual;
  }
  return heuristic;
}

const VAR_RE = /var\(\s*(--[a-zA-Z0-9-]+)/g;

/** Every `var(--x)` reference in a declaration value, in order of appearance. */
function varRefs(value: string): string[] {
  return [...value.matchAll(VAR_RE)].map((m) => m[1]);
}

function lastColorVarRef(value: string): string | undefined {
  const colorRefs = varRefs(value).filter((ref) => ref.startsWith("--color-"));
  return colorRefs[colorRefs.length - 1];
}

/** Every combination of axis values, as one variant key per combination. */
function cartesian(axes: ComponentRegistryAxis[]): Record<string, string>[] {
  return axes.reduce<Record<string, string>[]>(
    (acc, axis) => acc.flatMap((row) => axis.values.map((v) => ({ ...row, [axis.prop]: v }))),
    [{}],
  );
}

function fragmentFor(axis: ComponentRegistryAxis, value: string, part?: string): string | null {
  const partSelectors = part === undefined ? undefined : axis.partValueSelectors?.[part];
  if (partSelectors && value in partSelectors) {
    return partSelectors[value];
  }
  if (axis.valueSelectors && value in axis.valueSelectors) {
    return axis.valueSelectors[value];
  }
  return `[${axis.attribute}="${value}"]`;
}

/**
 * Does the fragment an index entry represents hold for this cell? Normally the
 * cell's axis value equals the entry's value; for an "attribute omitted" entry
 * (see `attributeOmittedWhenNull`) the attribute is present for every value
 * EXCEPT the entry's.
 */
function fragmentHolds(
  match: { axis: ComponentRegistryAxis; values: readonly string[]; absentWhenValue?: boolean },
  key: Record<string, string>,
): boolean {
  const equal = match.values.includes(key[match.axis.prop]);
  return match.absentWhenValue ? !equal : equal;
}

/** Every non-null fragment string → the axis and the values whose cells it holds for. */
type AxisFragmentMap = Map<
  string,
  { axis: ComponentRegistryAxis; values: readonly string[]; absentWhenValue?: boolean }
>;

interface FragmentIndex {
  base: AxisFragmentMap;
  byPart: ReadonlyMap<string, AxisFragmentMap>;
  /**
   * The standard State axis, when the component has one. Its value decides every state
   * pseudo-class and attribute for the cell, so a negation such as `:not(:focus-visible)` is
   * answered rather than refused, and rules under `(hover: hover)` are read.
   */
  stateAxis?: ComponentRegistryAxis;
}

/** The ARIA spelling of the invalid state that stylesheets write beside `[data-invalid]`. */
const ARIA_INVALID_FRAGMENT = '[aria-invalid="true"]';

/** Indexes, per axis and value, the CSS that value selects, optionally for one part. */
function buildAxisFragmentMap(axes: ComponentRegistryAxis[], part?: string): AxisFragmentMap {
  const index: AxisFragmentMap = new Map();
  for (const axis of axes) {
    // Each attribute of a fragment holds for every value whose fragment contains it (see
    // `fragmentValueSets`), so a rule on `[data-has-icon]` reads each cell that carries it.
    const fragments = axis.values.map((value) => fragmentFor(axis, value, part));
    for (const [fragment, positions] of fragmentValueSets(fragments)) {
      index.set(fragment, { axis, values: positions.map((position) => axis.values[position]) });
    }
    // Base UI marks an invalid control `data-invalid` and the component sets `aria-invalid` with
    // it, and a stylesheet may write either (`:not([data-invalid]):not([aria-invalid="true"])`).
    // An axis that maps a value to one spelling answers the other.
    const invalid = index.get("[data-invalid]");
    if (invalid && !index.has(ARIA_INVALID_FRAGMENT)) index.set(ARIA_INVALID_FRAGMENT, invalid);
    // A valueless `[attr]` / `:not([attr])` is only decidable for an axis whose
    // attribute the runtime omits for its null-selector value
    // (`attributeOmittedWhenNull`): that value means "attribute absent", every
    // other value means "present".
    if (axis.attributeOmittedWhenNull) {
      const nullValue = axis.values.find((v) => fragmentFor(axis, v, part) === null);
      const bare = `[${axis.attribute}]`;
      if (nullValue !== undefined && !index.has(bare)) {
        index.set(bare, { axis, values: [nullValue], absentWhenValue: true });
      }
    }
  }
  return index;
}

/**
 * Builds the axis fragment maps for the root and for each part that has its own value selectors.
 */
function buildFragmentIndex(axes: ComponentRegistryAxis[]): FragmentIndex {
  const byPart = new Map<string, AxisFragmentMap>();
  for (const axis of axes) {
    for (const part of Object.keys(axis.partValueSelectors ?? {})) {
      if (!byPart.has(part)) byPart.set(part, buildAxisFragmentMap(axes, part));
    }
  }
  const stateAxis = axes.find(isStandardStateAxis);
  return { base: buildAxisFragmentMap(axes), byPart, ...(stateAxis ? { stateAxis } : {}) };
}

/**
 * Whether a state pseudo-class or attribute holds in a cell that has a State value, or `undefined`
 * when the State axis cannot say (no State axis, or a selector it neither maps nor recognises as a
 * state), which leaves it to the ordinary axis matching.
 *
 * A positive selector is read exactly: the one the axis maps to the cell's value, the Hover
 * selector in a Pressed cell, and any spelling of "disabled" in the Disabled cell. A negated one is
 * judged by what it tests, so `:not(:focus-visible)` holds in every cell but the focused one.
 */
function stateSelectorHolds(
  fragmentIndex: FragmentIndex,
  state: string | undefined,
  fragments: AxisFragmentMap,
  selector: string,
  negated: boolean,
): boolean | undefined {
  if (state === undefined) return undefined;
  if (negated) {
    const holds = stateFacetHolds(state, selector);
    return holds === undefined ? undefined : !holds;
  }
  const mapped = fragments.get(selector);
  if (mapped && mapped.axis === fragmentIndex.stateAxis) {
    return mapped.values.some((value) => stateValueHolds(state, value));
  }
  return stateDisabledAliasHolds(state, selector);
}

/** The cell's value on the standard State axis, or `undefined` for a component without one. */
function stateOfCell(
  fragmentIndex: FragmentIndex,
  key: Record<string, string>,
): string | undefined {
  return fragmentIndex.stateAxis ? key[fragmentIndex.stateAxis.prop] : undefined;
}

/**
 * The fragment map that applies to ONE selector compound: the per-part map when
 * the compound names (`[data-ui="x"]`, not negated) a part with a
 * `partValueSelectors` override, else the axis-level map. Scoped per compound
 * so `[data-ui="root"][data-orientation="vertical"] [data-ui="separator"]`
 * reads the root's attribute through the root's mapping.
 */
function fragmentsForCompound(
  fragmentIndex: FragmentIndex,
  compound: ParsedCompoundSelector,
): AxisFragmentMap {
  if (fragmentIndex.byPart.size === 0) return fragmentIndex.base;
  const part = compound.attributes.find(
    (attr) => attr.name === "data-ui" && !attr.negated && attr.value !== null,
  )?.value;
  return (part && fragmentIndex.byPart.get(part)) || fragmentIndex.base;
}

interface CandidateRule {
  declarations: Array<{ property: string; value: string }>;
  specificity: number;
  sourceIndex: number;
}

const FIGMA_SLOT_RANK: Readonly<Record<string, number>> = {
  "box-shadow": 1,
  outline: 2,
  "outline-color": 2,
};

function cascadeDeclarations(
  candidates: ReadonlyArray<{
    declarations: ReadonlyArray<{ property: string; value: string }>;
    specificity: number;
    sourceIndex: number;
  }>,
  { winnersOnly = true }: { winnersOnly?: boolean } = {},
): Array<{ property: string; value: string }> {
  interface Positioned {
    property: string;
    value: string;
    specificity: number;
    sourceIndex: number;
    declIndex: number;
  }
  const all: Positioned[] = [];
  for (const candidate of candidates) {
    candidate.declarations.forEach((decl, declIndex) => {
      all.push({
        property: decl.property,
        value: decl.value,
        specificity: candidate.specificity,
        sourceIndex: candidate.sourceIndex,
        declIndex,
      });
    });
  }
  const cascadeCompare = (a: Positioned, b: Positioned) =>
    a.specificity - b.specificity || a.sourceIndex - b.sourceIndex || a.declIndex - b.declIndex;

  let applied = all;
  if (winnersOnly) {
    const winners = new Map<string, Positioned>();
    for (const decl of all) {
      const current = winners.get(decl.property);
      if (!current || cascadeCompare(decl, current) > 0) winners.set(decl.property, decl);
    }
    applied = [...winners.values()];
  }
  return applied
    .sort(
      (a, b) =>
        a.specificity - b.specificity ||
        (FIGMA_SLOT_RANK[a.property] ?? 0) - (FIGMA_SLOT_RANK[b.property] ?? 0) ||
        a.sourceIndex - b.sourceIndex ||
        a.declIndex - b.declIndex,
    )
    .map(({ property, value }) => ({ property, value }));
}

function withSortedKeys<T extends object>(record: T): T {
  return Object.fromEntries(
    Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  ) as T;
}

/** The component's root and the parts declared inside it. */
interface RootContext {
  root: string;
  inside: ReadonlySet<string>;
}

/**
 * The component's root, and the parts that sit inside it. Parts are listed in source order with
 * the outermost part first, so a part declared after the root is a section within it (a card's
 * header and footer), while one declared before it is a wrapper around it (a select around its
 * trigger). The root itself is included: a root inside another root is a nested instance.
 */
function rootContext(entry: ComponentRegistryEntry): RootContext {
  const root = entry.componentRoot ?? entry.rootPart;
  const position = entry.parts.indexOf(root);
  return { root, inside: new Set([root, ...entry.parts.slice(position + 1)]) };
}

/** What one cell renders, with the context its structural pseudo-classes are answered in. */
interface CellStructure {
  tree: RenderedNode;
  context: StructureContext;
  /** Parts rendered inside a pointer target (`pointerTargetParts`) in this cell. */
  pointerShadowed: ReadonlySet<string>;
}

/** Pointer pseudo-classes: they hold on the element under the pointer and its ancestors only. */
const POINTER_PSEUDOS: ReadonlySet<string> = new Set([":hover", ":active"]);

/**
 * The parts a stylesheet styles for the pointer on themselves: the subject of a rule with a
 * `:hover` or `:active` on that same part, such as a field and the clear button inside it.
 */
function pointerTargetParts(rules: readonly CssRule[]): Set<string> {
  const targets = new Set<string>();
  for (const rule of rules) {
    for (const selector of rule.selectors) {
      for (const compounds of parseSelectorVariants(selector).variants) {
        const subject = compounds.at(-1);
        const part = subject && partOf(subject);
        if (part && subject.pseudos.some((pseudo) => POINTER_PSEUDOS.has(pseudo))) {
          targets.add(part);
        }
      }
    }
  }
  return targets;
}

/**
 * The parts rendered inside a pointer target in one cell. A State cell puts the pointer on the
 * outermost target, and in a browser `:hover` and `:active` then hold on that element and its
 * ancestors, never on a target inside it: hovering the field does not hover its clear button.
 */
function pointerShadowedParts(tree: RenderedNode, targets: ReadonlySet<string>): Set<string> {
  const shadowed = new Set<string>();
  const walk = (node: RenderedNode, insideTarget: boolean): void => {
    if (insideTarget) shadowed.add(node.part);
    for (const child of node.children) walk(child, insideTarget || targets.has(node.part));
  };
  walk(tree, false);
  return shadowed;
}

/**
 * The rendered structure of one cell (see `anatomy-match.ts`), or undefined without an anatomy or
 * when the cell does not render its root. Axis attributes inside a `:has()` argument are read
 * through the same fragment index the rest of the resolver uses.
 */
function structureForCell(
  anatomy: ResolveAnatomy | undefined,
  key: Record<string, string>,
  fragmentIndex: FragmentIndex,
  pointerTargets: ReadonlySet<string>,
): CellStructure | undefined {
  if (!anatomy) return undefined;
  const tree = renderedTree(anatomy, key);
  if (!tree) return undefined;
  return {
    tree,
    pointerShadowed: pointerShadowedParts(tree, pointerTargets),
    context: {
      modelled: new Set(anatomy.modelled),
      omitted: new Set(anatomy.omitted),
      attribute: (compound, attribute) => {
        const fragment =
          attribute.value === null
            ? `[${attribute.name}]`
            : `[${attribute.name}="${attribute.value}"]`;
        const match = fragmentsForCompound(fragmentIndex, compound).get(fragment);
        if (!match) return "unknown";
        return attribute.negated ? !fragmentHolds(match, key) : fragmentHolds(match, key);
      },
    },
  };
}

/** Whether a compound's `:has()` and position pseudo-classes hold in the cell's rendered structure. */
function structureHolds(
  pseudos: readonly string[],
  compound: ParsedCompoundSelector,
  isSubject: boolean,
  subjectPart: string,
  structure: CellStructure | undefined,
): boolean {
  if (!structure) return false;
  return structuralPseudosHold({
    pseudos,
    compound,
    subjectPart,
    isSubject,
    tree: structure.tree,
    context: structure.context,
  });
}

/**
 * Does this rule's ROOT-part compound selector apply to `key`? Returns the
 * candidate (with its computed specificity) if so, `null` if the rule doesn't
 * apply to this cell at all (wrong root part, interactive-only, or an
 * attribute constraint that conflicts with `key`).
 */
function matchRuleForCell(
  rule: CssRule,
  rootPart: string,
  knownParts: ReadonlySet<string>,
  fragmentIndex: FragmentIndex,
  key: Record<string, string>,
  sourceIndex: number,
  requiredPseudoElement?: string,
  refusals?: Map<string, string>,
  /**
   * Where the component's own root sits among its parts (`rootContext`). A rule aimed at the root
   * inside a part declared within it, such as a card nested in another card's header, describes a
   * nested instance, so it never applies to the plain component.
   */
  context?: RootContext,
  /**
   * What this cell renders, when the contract's anatomy is known (`structureForCell`): the
   * `:has()` and position pseudo-classes are answered from it. Without it they never apply.
   */
  structure?: CellStructure,
): CandidateRule | null {
  if (!mediaConditionsHold(rule.media, fragmentIndex.stateAxis !== undefined)) return null;
  const state = stateOfCell(fragmentIndex, key);

  let bestMatch: CandidateRule | null = null;
  // Each selector as the plain selectors it stands for: `:is()` and `:where()` arguments are tried
  // one by one, all at the specificity the browser gives the original selector.
  const alternatives = rule.selectors.flatMap((rawSelector) => {
    const { specificity, variants } = parseSelectorVariants(rawSelector);
    return variants.map((compounds) => ({ compounds, specificity }));
  });
  for (const { compounds: parsedCompounds, specificity } of alternatives) {
    const target = parsedCompounds.at(-1);
    if (!target || target.type) continue; // A bare type selector (e.g. `svg`) is never a named part.
    const targetRootAttr = target.attributes.find((attr) => attr.name === "data-ui");
    if (!targetRootAttr || targetRootAttr.value !== rootPart) continue;
    if (requiredPseudoElement && !target.pseudos.includes(requiredPseudoElement)) continue;

    let applies = true;

    for (const [compoundIndex, parsed] of parsedCompounds.entries()) {
      const isTarget = compoundIndex === parsedCompounds.length - 1;
      const dataUiAttributes = parsed.attributes.filter((attr) => attr.name === "data-ui");
      if (!isTarget) {
        // The plain component is never inside one of its own parts: such a selector is the root
        // nested in another instance's section, a context the plain component does not have.
        if (
          context &&
          rootPart === context.root &&
          dataUiAttributes.some(
            (attribute) => attribute.value !== null && context.inside.has(attribute.value),
          )
        ) {
          applies = false;
          break;
        }
        // The registry contains the component's known `data-ui` parts, but not its
        // full rendered topology. An ancestor selector is safe only when it names
        // one of those known parts; otherwise its relationship cannot be verified.
        if (
          dataUiAttributes.some(
            (attribute) => attribute.value === null || !knownParts.has(attribute.value),
          )
        ) {
          applies = false;
          break;
        }
      }

      const compoundFragments = fragmentsForCompound(fragmentIndex, parsed);
      const structural = parsed.pseudos.filter((pseudo) => parseStructuralPseudo(pseudo));
      // A part inside a pointer target is not under the pointer in any cell (`pointerShadowedParts`).
      const named = partOf(parsed);
      const shadowed = named !== undefined && structure?.pointerShadowed.has(named) === true;
      for (const pseudo of parsed.pseudos) {
        if (isTarget && requiredPseudoElement && pseudo === requiredPseudoElement) {
          continue;
        }
        if (structural.includes(pseudo)) continue; // Answered from the anatomy, below.
        if (shadowed && POINTER_PSEUDOS.has(pseudo)) {
          applies = false;
          break;
        }
        // A state pseudo-class is answered by the cell's State value when it has one.
        const stateHolds = stateSelectorHolds(
          fragmentIndex,
          state,
          compoundFragments,
          pseudo,
          false,
        );
        if (stateHolds !== undefined) {
          if (!stateHolds) {
            applies = false;
            break;
          }
          continue;
        }
        if (!pseudoMatchesAxis(pseudo, compoundFragments, key)) {
          applies = false;
          break;
        }
      }
      if (!applies) break;
      if (
        structural.length > 0 &&
        !structureHolds(structural, parsed, isTarget, rootPart, structure)
      ) {
        applies = false;
        break;
      }

      // `:not(:pseudo)`: the compound holds only if the pseudo-class does not. The State value
      // answers a state pseudo-class; an axis that maps the pseudo-class answers it otherwise;
      // anything else cannot be verified, so the rule is refused rather than guessed.
      for (const pseudo of parsed.negatedPseudos ?? []) {
        if (shadowed && POINTER_PSEUDOS.has(pseudo)) continue;
        const mapped = compoundFragments.get(pseudo);
        const negationHolds =
          stateSelectorHolds(fragmentIndex, state, compoundFragments, pseudo, true) ??
          (mapped === undefined ? undefined : !fragmentHolds(mapped, key));
        if (!negationHolds) {
          applies = false;
          break;
        }
      }
      if (!applies) break;

      for (const attr of parsed.attributes) {
        if (attr.name === "data-ui") continue;
        const fragment = attr.value === null ? `[${attr.name}]` : `[${attr.name}="${attr.value}"]`;
        // A state attribute (`[data-disabled]`) is answered by the cell's State value too.
        const stateHolds = stateSelectorHolds(
          fragmentIndex,
          state,
          compoundFragments,
          fragment,
          attr.negated === true,
        );
        if (stateHolds !== undefined) {
          if (!stateHolds) {
            applies = false;
            break;
          }
          continue;
        }
        const match = compoundFragments.get(fragment);
        if (!match) {
          if (attr.negated) {
            refusals?.set(
              fragment,
              `:not(${fragment}) — "${attr.name}" is not a resolved axis attribute for this component; ` +
                "the negation can't be verified, so the rule is refused rather than guessed.",
            );
            applies = false;
            continue;
          }
          // An attribute this resolver doesn't recognise as one of the resolved
          // axes (e.g. `[data-icon-only]` when icon-only isn't being resolved).
          // Conservative: don't apply a rule with a constraint we can't verify.
          applies = false;
          break;
        }
        const satisfied = fragmentHolds(match, key);
        if (attr.negated ? satisfied : !satisfied) {
          applies = false;
          break;
        }
      }
    }
    if (!applies) continue;

    const candidate = { declarations: rule.declarations, specificity, sourceIndex };
    if (!bestMatch || candidate.specificity > bestMatch.specificity) bestMatch = candidate;
  }
  return bestMatch;
}

type TextStyleResult =
  | { kind: "none" }
  | { kind: "unresolved"; stems: string[] }
  | { kind: "textStyle"; textStyle: string };

type EffectStyleResult =
  | { kind: "none" }
  | { kind: "effectStyle"; effectStyle: string; ring?: { color: string; width: string } }
  | { kind: "ring"; ring: { color: string; width: string } }
  | { kind: "unresolved"; value: string };

// Each font property maps to its possible suffixes — the first is the heuristic
// form (`-font-family`), the second is the snapshot-resolved form (`/fontFamily`).
// Both must be recognized so `deriveTextStyle` can strip the suffix to recover the
// typography stem regardless of which naming the snapshot lookup produced.
const FONT_PROP_SUFFIXES: Partial<Record<keyof ResolvedGeometry, readonly string[]>> = {
  fontFamily: ["-font-family", "/fontFamily"],
  fontSize: ["-font-size", "/fontSize"],
  fontWeight: ["-font-weight", "/fontWeight"],
  lineHeight: ["-line-height", "/lineHeight"],
  letterSpacing: ["-letter-spacing", "/letterSpacing"],
};

const REQUIRED_TYPOGRAPHY_PROPERTIES = ["fontFamily", "fontSize", "fontWeight"] as const;

/**
 * Derives the text style a geometry's typography properties name, or reports which required ones
 * are missing.
 */
function deriveTextStyle(geometry: ResolvedGeometry): TextStyleResult {
  const stems: string[] = [];
  for (const [prop, suffixes] of Object.entries(FONT_PROP_SUFFIXES)) {
    const value = geometry[prop as keyof ResolvedGeometry];
    const required = REQUIRED_TYPOGRAPHY_PROPERTIES.includes(
      prop as (typeof REQUIRED_TYPOGRAPHY_PROPERTIES)[number],
    );
    if (!value) {
      if (!required) continue;
      return { kind: "unresolved", stems };
    }
    if (typeof value !== "string" || !value.startsWith("typography/")) {
      if (!required) continue;
      return { kind: "unresolved", stems };
    }
    const suffix = suffixes.find((candidate) => value.endsWith(candidate));
    if (!suffix) {
      if (!required) continue;
      return { kind: "unresolved", stems };
    }
    stems.push(value.slice(0, -suffix.length));
  }
  if (stems.length === 0) return { kind: "none" };
  const unique = [...new Set(stems)];
  if (unique.length !== 1) return { kind: "unresolved", stems };
  return { kind: "textStyle", textStyle: unique[0] };
}

const RING_RE =
  /^(?:inset\s+)?0\s+0\s+0\s+(var\(\s*--[a-zA-Z0-9-]+\s*\))\s+(var\(\s*--[a-zA-Z0-9-]+\s*\))$/;

/** Parses a `0 0 0 <width> <color>` shadow part into its width and colour variables, or `null`. */
function extractRing(part: string): { color: string; width: string } | null {
  const m = part.trim().match(RING_RE);
  if (!m) return null;
  const widthRef = varRefs(m[1])[0];
  const colorRef = varRefs(m[2])[0];
  if (!widthRef || !colorRef) return null;
  return { width: cssVarToFigmaVariableName(widthRef), color: cssVarToFigmaVariableName(colorRef) };
}

/**
 * Derives the effect style variable a box-shadow value references, separating out focus rings and
 * reporting references it cannot map.
 */
function deriveEffectStyle(value: string): EffectStyleResult {
  const parts = splitTopLevel(value, ",");
  let effectStyleVar: string | null = null;
  let ringPart: { color: string; width: string } | null = null;
  let hasUnrecognizedVarPart = false;
  for (const part of parts) {
    const trimmed = part.trim();
    const ring = extractRing(trimmed);
    if (ring) {
      if (ringPart) return { kind: "unresolved", value };
      ringPart = ring;
      continue;
    }
    const refs = varRefs(trimmed);
    if (refs.length === 1 && /^var\(\s*--[a-zA-Z0-9-]+\s*\)$/.test(trimmed)) {
      if (effectStyleVar) return { kind: "unresolved", value };
      effectStyleVar = cssVarToFigmaVariableName(refs[0]);
      continue;
    }
    if (refs.length > 0) hasUnrecognizedVarPart = true;
  }
  if (hasUnrecognizedVarPart) return { kind: "unresolved", value };
  if (effectStyleVar && ringPart)
    return { kind: "effectStyle", effectStyle: effectStyleVar, ring: ringPart };
  if (effectStyleVar) return { kind: "effectStyle", effectStyle: effectStyleVar };
  if (ringPart) return { kind: "ring", ring: ringPart };
  return { kind: "none" };
}

/**
 * Every `ResolvedGeometry` key `GEOMETRY_PROPERTIES` may map to: `width`/`height`
 * (dispatched to `parseDimension`, handled before this map's generic fallback) plus
 * every remaining key whose value is a plain variable-name STRING. Deliberately
 * excludes `layoutMode`/`primaryAxisAlignItems`/`counterAxisAlignItems`/
 * `textAlignHorizontal`/`alignItems` — those are Figma enums (or, for `alignItems`,
 * the one CSS keyword `counterAxisAlignItems` can't express) set by their own
 * dedicated `align-items`/`flex-direction`/`justify-content`/`text-align` branches
 * in `applyDeclaration`, never a `var()` name, so they must never reach this map's
 * generic `geometry[dimensionKey] = cssVarToFigmaVariableName(...)` fallback.
 */
type GeometryMapKey =
  | "width"
  | "height"
  | Exclude<
      keyof ResolvedGeometry,
      | "width"
      | "height"
      | "layoutMode"
      | "primaryAxisAlignItems"
      | "counterAxisAlignItems"
      | "alignSelf"
      | "marginTop"
      | "marginRight"
      | "marginBottom"
      | "marginLeft"
      | "textAlignHorizontal"
      | "textCase"
      | "alignItems"
      // A parent-relative boolean intent, set by its own `flex`/`flex-grow`
      // branch — never a `var()` name, so it must not reach this map's generic
      // string fallback either.
      | "growsOnMainAxis"
      | "radiusPx"
      // Size limits, overflow, wrap, row-gap, translate and percentage insets each have a
      // dedicated branch in `applyDeclaration`; none is a plain variable name written here.
      | "minWidth"
      | "maxWidth"
      | "minHeight"
      | "maxHeight"
      | "minWidthPx"
      | "maxWidthPx"
      | "minHeightPx"
      | "maxHeightPx"
      | "clipsContent"
      | "layoutWrap"
      | "counterAxisSpacing"
      | "rowGap"
      | "translateXPx"
      | "insetPercent"
      | "constraints"
      // Written only by `applyPaddingDeclaration`, never via this map.
      | "paddingInline"
      | "paddingBlock"
      | "paddingLeft"
      | "paddingRight"
      | "paddingTop"
      | "paddingBottom"
      // Written only by `applyBorderSideDeclaration`, never via this map.
      | "borderTopWidth"
      | "borderRightWidth"
      | "borderBottomWidth"
      | "borderLeftWidth"
    >;

const GEOMETRY_PROPERTIES: Record<string, GeometryMapKey> = {
  // Every padding form (`padding`, the physical and logical longhands) is handled by
  // `applyPaddingDeclaration`, which keeps per-side state — not a single-value key.
  gap: "gap",
  "border-radius": "radius",
  "border-width": "borderWidth",
  // SVG stroke weight (a `<circle>` ring, e.g. Spinner's track) is the same Figma
  // strokeWeight a CSS border width is.
  "stroke-width": "borderWidth",
  "font-family": "fontFamily",
  "font-size": "fontSize",
  "font-weight": "fontWeight",
  "line-height": "lineHeight",
  "letter-spacing": "letterSpacing",
  opacity: "opacity",
  width: "width",
  height: "height",
  "inline-size": "width",
  "block-size": "height",
};

function isBindableGeometryValue(
  value: string,
  localCustomProperties: ReadonlyMap<string, string>,
): boolean {
  if (/\bcalc\(/.test(value)) return false;
  if (/var\(\s*--[a-zA-Z0-9-]+\s*,/.test(value)) return false;
  const refs = varRefs(value);
  if (refs.length !== 1) return false;
  return !localCustomProperties.has(refs[0]);
}

/**
 * A local custom property's value is exactly one bare `var(--token)` reference —
 * no `calc()`, no fallback, no second term. `--switch-inline-size: var(--spacing-900);`
 * matches; `--switch-thumb-size: calc(var(--switch-block-size) - ...)` does not.
 */
const SIMPLE_VAR_ALIAS_RE = /^var\(\s*(--[a-zA-Z0-9-]+)\s*\)$/;

/** Bound hop count for `resolveLocalCustomPropertyAlias` — see there for why. */
const MAX_ALIAS_HOPS = 3;

function resolveLocalCustomPropertyAlias(
  varName: string,
  localCustomProperties: ReadonlyMap<string, string>,
  hop = 0,
): string | null {
  const declared = localCustomProperties.get(varName);
  if (declared === undefined) return varName; // Not a local alias — already a real token name.
  if (hop >= MAX_ALIAS_HOPS) return null;
  const trimmed = declared.trim().replace(/\s+/g, " ");
  const match = SIMPLE_VAR_ALIAS_RE.exec(trimmed);
  if (!match) return null; // calc()/fallback/literal — not a single hop, refuse.
  return resolveLocalCustomPropertyAlias(match[1], localCustomProperties, hop + 1);
}

/**
 * `calc(<number> * var(--token))` / `calc(var(--token) * <number>)` — the ONLY
 * `calc()` shape this resolver resolves, and only to a LITERAL px value (never a
 * variable name — `calc` has no Figma expression equivalent to bind to).
 *
 * `otp-field-input` sizes its cells with `calc(11 * var(--brand-scale-base-ui))`:
 * a pure multiple of one known token. That is fully determined at build time —
 * unlike Switch's thumb `calc()` (three locals, two arithmetic operators), there
 * is exactly one operand and one operator, so there is nothing to lose by
 * resolving it now rather than refusing it forever.
 *
 * Producing a LITERAL here (rather than refusing, as every other `calc()` is) is
 * safe specifically because it is DERIVED at build time from the token's current
 * resolved value on every regeneration — it is recomputed from
 * `--brand-scale-base-ui`'s live value each time `figma:contract` runs, so it
 * cannot drift from the token the way a hand-written literal would. Figma has no
 * expression/formula variable type, so there is no binding that could express
 * "11 times this token" — a literal is the only honest representation, and this
 * one is provably in sync with the token it came from.
 *
 * Anything richer — two terms, addition/subtraction, a second `var()`, a nested
 * `calc()`, a percentage — does not match this regex and falls through to the
 * general `calc()` refusal in `isBindableGeometryValue`.
 */
const CALC_MULTIPLE_RE =
  /^calc\(\s*(?:(\d+(?:\.\d+)?)\s*\*\s*var\(\s*(--[a-zA-Z0-9-]+)\s*\)|var\(\s*(--[a-zA-Z0-9-]+)\s*\)\s*\*\s*(\d+(?:\.\d+)?))\s*\)$/;

/**
 * Injected by `setResolvedTokenPxValues()` (build scripts only) — a normalized
 * CSS custom-property name → its resolved numeric px value, sourced from the
 * project's own DTCG. Optional and unset by default: the two dependency-free JS
 * mirrors that run inside scaffolded projects have no DTCG to read, and without a
 * value to multiply by, `calc(<n> * var(--x))` correctly stays refused for them —
 * same opt-in shape as `setKnownVariableMap` above.
 */
let _resolvedTokenPxValues: Map<string, number> | undefined;

/**
 * Inject the token px-value map used to resolve `calc(<number> * var(--token))`
 * dimensions to a literal. Call once before `buildGenerationContractArtifact` in
 * build scripts, alongside `setKnownVariableMap`.
 */
export function setResolvedTokenPxValues(map: Map<string, number> | undefined): void {
  _resolvedTokenPxValues = map;
}

/** The injected token px-value map (normalized token name → px), or `undefined` when none is set. */
export function getResolvedTokenPxValues(): ReadonlyMap<string, number> | undefined {
  return _resolvedTokenPxValues;
}

/**
 * Resolve `calc(<number> * var(--token))` (either operand order) to a literal px
 * value using the injected token map, or `undefined` when the shape doesn't match
 * or the token's value isn't known (falls through to the general `calc()` refusal).
 */
function resolveCalcMultipleOfToken(trimmed: string): number | undefined {
  const match = CALC_MULTIPLE_RE.exec(trimmed);
  if (!match || !_resolvedTokenPxValues) return undefined;
  const factor = Number(match[1] ?? match[4]);
  const varName = match[2] ?? match[3];
  if (!Number.isFinite(factor)) return undefined;
  const tokenPx = _resolvedTokenPxValues.get(normalizeVariableName(varName.replace(/^--/, "")));
  if (tokenPx === undefined) return undefined;
  return factor * tokenPx;
}

/**
 * A single `+`/`-`-joined term inside a linear `calc()` expression: an optional
 * numeric coefficient (either operand order) times a bare `var(--token)`
 * reference, or a bare number, or a bare `var(--token)` reference (coefficient
 * 1). Matches the SAME atoms `CALC_MULTIPLE_RE` matches for a whole expression —
 * this is that regex's per-term building block, not a separate vocabulary.
 */
const CALC_LINEAR_TERM_VAR_RE = /^var\(\s*(--[a-zA-Z0-9-]+)\s*\)$/;
const CALC_LINEAR_TERM_NUMBER_RE = /^\d+(?:\.\d+)?$/;

/**
 * Resolve ONE term of a linear `calc()` expression (see `resolveCalcLinearExpression`)
 * to a signless numeric px value, or `undefined` if this term isn't the narrow
 * `<number> * var(--token)` / `var(--token) * <number>` / `var(--token)` / `<number>`
 * shape — e.g. it has two `var()` factors, a fallback, a unit suffix (`1px`), or
 * more than two factors. A local custom-property alias is followed exactly ONE hop
 * via `resolveLocalCustomPropertyAlias`, same as every other geometry value in this
 * file — Switch's thumb reads `--switch-block-size`/`--switch-padding`, both of
 * which are themselves `var(--spacing-*)` aliases, not raw tokens.
 */
function resolveCalcLinearTerm(
  text: string,
  localCustomProperties: ReadonlyMap<string, string>,
): number | undefined {
  const factors = text.trim().split(/\s*\*\s*/);
  if (factors.length === 0 || factors.length > 2) return undefined;
  let coefficient = 1;
  let varName: string | undefined;
  for (const factor of factors) {
    if (CALC_LINEAR_TERM_NUMBER_RE.test(factor)) {
      coefficient *= Number(factor);
      continue;
    }
    const varMatch = CALC_LINEAR_TERM_VAR_RE.exec(factor);
    if (varMatch) {
      if (varName !== undefined) return undefined; // Two var() factors — not linear, refuse.
      varName = varMatch[1];
      continue;
    }
    return undefined; // Not a bare number or a bare var() — e.g. `1px`, a fallback. Refuse.
  }
  if (varName === undefined) return coefficient; // A pure numeric term — unusual, but valid.
  if (!_resolvedTokenPxValues) return undefined;
  const resolvedName = resolveLocalCustomPropertyAlias(varName, localCustomProperties);
  if (resolvedName === null) return undefined;
  const px = _resolvedTokenPxValues.get(normalizeVariableName(resolvedName.replace(/^--/, "")));
  if (px === undefined) return undefined;
  return coefficient * px;
}

function resolveCalcLinearExpression(
  trimmed: string,
  localCustomProperties: ReadonlyMap<string, string>,
): number | undefined {
  if (!_resolvedTokenPxValues) return undefined;
  const calcMatch = /^calc\(\s*(.+)\s*\)$/.exec(trimmed);
  if (!calcMatch) return undefined;
  // `.+` is greedy and CSS allows whitespace on either side of the parens
  // (`calc( ... )`), so the capture can carry a trailing space the caller's own
  // whitespace collapse didn't remove — trim before splitting into terms, or a
  // numeric factor like the LAST term's `2` (with a trailing space from before
  // the closing paren) fails `CALC_LINEAR_TERM_NUMBER_RE`'s exact `$` anchor.
  const body = calcMatch[1].trim();
  // Anything outside "a linear combination of numbers and var()s" is out of
  // scope — bail before attempting to parse rather than guessing at meaning.
  if (/[%/]|calc\(|min\(|max\(|clamp\(|var\([^)]*,/.test(body)) return undefined;

  // Split on top-level "+"/"-" operators — always surrounded by whitespace per
  // CSS syntax (the caller already collapsed authoring whitespace to single
  // spaces) — capturing the operator so later terms carry their sign. A leading
  // unary sign (no term before it) is folded into the first term explicitly.
  const rawParts = body.split(/\s+([+-])\s+/);
  let leadingSign = 1;
  let firstTermText = rawParts[0];
  const leadingSignMatch = /^([+-])\s*(.+)$/.exec(firstTermText);
  if (leadingSignMatch) {
    leadingSign = leadingSignMatch[1] === "-" ? -1 : 1;
    firstTermText = leadingSignMatch[2];
  }

  const terms: Array<{ sign: number; text: string }> = [{ sign: leadingSign, text: firstTermText }];
  for (let i = 1; i < rawParts.length; i += 2) {
    const op = rawParts[i];
    const text = rawParts[i + 1];
    if (text === undefined) return undefined;
    terms.push({ sign: op === "-" ? -1 : 1, text });
  }
  // A single term with no +/- at all isn't a combination this function exists
  // for — `resolveCalcMultipleOfToken` already owns that shape, and letting it
  // through here too would just be a slower path to the same answer.
  if (terms.length < 2) return undefined;

  let total = 0;
  for (const term of terms) {
    const value = resolveCalcLinearTerm(term.text, localCustomProperties);
    if (value === undefined) return undefined; // One unresolved operand refuses everything.
    total += term.sign * value;
  }
  return total;
}

/**
 * The variable a COMPUTED corner radius falls back to: the brand's default radius. A radius that
 * only resolves through `calc()`/`min()`/`max()`/`clamp()` (or a local custom property declared
 * that way) is arithmetic over values that differ per brand, and a Figma variable cannot hold
 * arithmetic, so there is no single variable it could bind. Rather than leaving the corner
 * unbound (square), or binding one operand and presenting it as the whole value, every such
 * corner binds this one role, consistently. The fallback is decided here, once, never per
 * component, and is reported in `radiusFallbacks` so a reviewer sees which corners took it.
 */
export const COMPUTED_RADIUS_FALLBACK_TOKEN = "--radius-default";

const COMPUTED_RADIUS_FUNCTION_RE = /\b(?:calc|min|max|clamp)\(/;

/**
 * Does this radius only resolve through an expression: written as one, or a bare local custom
 * property whose declaration (following bare aliases) is one?
 */
function isComputedRadius(
  value: string,
  localCustomProperties: ReadonlyMap<string, string>,
): boolean {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (COMPUTED_RADIUS_FUNCTION_RE.test(trimmed)) return true;
  let current = SIMPLE_VAR_ALIAS_RE.exec(trimmed)?.[1];
  for (let hop = 0; current !== undefined && hop <= MAX_ALIAS_HOPS; hop++) {
    const declared = localCustomProperties.get(current);
    if (declared === undefined) return false; // A real token (or a runtime value), not computed.
    const normalized = declared.trim().replace(/\s+/g, " ");
    if (COMPUTED_RADIUS_FUNCTION_RE.test(normalized)) return true;
    current = SIMPLE_VAR_ALIAS_RE.exec(normalized)?.[1];
  }
  return false;
}

/** Computed-radius fallbacks recorded while a part's cascade is applied: the CSS, for the report. */
const pendingRadiusFallbacks = new WeakMap<ResolvedGeometry, string>();

/** Moves a part's computed-radius fallback, if still in force, into `radiusFallbacks`. */
function collectRadiusFallbacks(
  geometry: ResolvedGeometry,
  radiusFallbacks: Map<string, string>,
  part: string,
): void {
  const message = pendingRadiusFallbacks.get(geometry);
  if (message !== undefined) radiusFallbacks.set(`${part} border-radius`, message);
}

/** CSS keywords that mean "size me from my content" — Figma's auto-layout hug. */
const HUG_KEYWORDS = new Set(["auto", "fit-content", "min-content", "max-content"]);
// Non-negative only: `resize()` rejects a negative dimension, and a negative box is
// not a box. Falling through to `unsupported` refuses it instead of emitting a
// literal the geometry audit would then count as "this node is sized".
const LITERAL_PX_RE = /^(\d+(?:\.\d+)?)px$/;

function mapAlignItems(value: string): "MIN" | "CENTER" | "MAX" | undefined {
  switch (value.trim()) {
    case "flex-start":
    case "start":
    case "stretch":
      return "MIN";
    case "center":
      return "CENTER";
    case "flex-end":
    case "end":
      return "MAX";
    default:
      return undefined;
  }
}

/**
 * `justify-content` → Figma's `primaryAxisAlignItems`. `space-around`/
 * `space-evenly` have no Figma equivalent (only `SPACE_BETWEEN` exists) and are
 * refused rather than approximated.
 */
function mapJustifyContent(value: string): "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN" | undefined {
  switch (value.trim()) {
    case "flex-start":
    case "start":
      return "MIN";
    case "center":
      return "CENTER";
    case "flex-end":
    case "end":
      return "MAX";
    case "space-between":
      return "SPACE_BETWEEN";
    default:
      return undefined;
  }
}

/**
 * `flex-direction` → Figma's `layoutMode`. `row-reverse`/`column-reverse` are
 * refused: Figma has no reversed-order auto-layout mode, and rendering the
 * children in source order under a plain `HORIZONTAL`/`VERTICAL` would silently
 * flip which end is visually first — a plausible-wrong layout, not a faithful one.
 */
function mapFlexDirection(value: string): "HORIZONTAL" | "VERTICAL" | undefined {
  switch (value.trim()) {
    case "row":
      return "HORIZONTAL";
    case "column":
      return "VERTICAL";
    default:
      return undefined;
  }
}

/**
 * `text-align` → Figma's `textAlignHorizontal`. `start`/`end` assume LTR in a
 * horizontal writing mode, the same documented assumption the logical size
 * properties make. `match-parent`, `justify-all`, and anything else unrecognised
 * is refused.
 */
function mapTextAlign(value: string): "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED" | undefined {
  switch (value.trim()) {
    case "left":
    case "start":
      return "LEFT";
    case "right":
    case "end":
      return "RIGHT";
    case "center":
      return "CENTER";
    case "justify":
      return "JUSTIFIED";
    default:
      return undefined;
  }
}

/** `text-transform` → Figma's `textCase`; anything without a Figma equivalent is refused. */
function mapTextTransform(value: string): "UPPER" | "LOWER" | "ORIGINAL" | undefined {
  switch (value.trim()) {
    case "uppercase":
      return "UPPER";
    case "lowercase":
      return "LOWER";
    // `capitalize` is refused: CSS uppercases only each word's first letter and keeps the
    // rest as written ("API" stays "API"), which Figma's title case does not promise.
    case "none":
      return "ORIGINAL";
    default:
      return undefined;
  }
}

const INSET_CALC_RE =
  /^calc\(\s*var\(\s*(--[a-zA-Z0-9-]+)\s*\)\s*-\s*(?:(\d+)\s*\*\s*var\(\s*(--[a-zA-Z0-9-]+)\s*\)|var\(\s*(--[a-zA-Z0-9-]+)\s*\)\s*\*\s*(\d+))\s*\)$/;

/** A custom property reference → the project token variable it names (directly or one alias hop away), or `undefined`. */
function tokenVariableForRef(
  ref: string,
  localCustomProperties: ReadonlyMap<string, string>,
): string | undefined {
  const resolved = resolveLocalCustomPropertyAlias(ref, localCustomProperties);
  if (resolved === null) return undefined;
  const variable = cssVarToFigmaVariableName(resolved);
  return isProjectToken(variable, resolved) ? variable : undefined;
}

/**
 * `calc(var(--whole) - <n> * var(--inset))` (either operand order), with both operands naming
 * project tokens: the shape of an item that fills its padded track (`height: calc(var(--ctl-height)
 * - 2 * var(--control-inset))`). `undefined` for every other expression.
 */
function parseInsetCalc(
  trimmed: string,
  localCustomProperties: ReadonlyMap<string, string>,
): DimensionInset | undefined {
  const match = INSET_CALC_RE.exec(trimmed);
  if (!match) return undefined;
  const count = Number(match[2] ?? match[5]);
  const whole = tokenVariableForRef(match[1], localCustomProperties);
  const inset = tokenVariableForRef(match[3] ?? match[4], localCustomProperties);
  if (!whole || !inset || !Number.isInteger(count) || count < 1) return undefined;
  return { whole, inset, count };
}

function parseDimension(
  value: string,
  localCustomProperties: ReadonlyMap<string, string>,
): ResolvedDimension {
  // Collapse authoring whitespace: a multi-line `calc()` is one value, and it gets
  // quoted verbatim in the coverage gate's refusal report.
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (HUG_KEYWORDS.has(trimmed)) return { kind: "hug" };
  if (trimmed === "100%") return { kind: "fill" };
  if (trimmed === "0") return { kind: "literal", px: 0 };
  const literal = LITERAL_PX_RE.exec(trimmed);
  if (literal) return { kind: "literal", px: Number(literal[1]) };
  // `calc(<number> * var(--token))` — a narrow, deterministic exception to the
  // general calc() refusal below. Tried BEFORE the general refusal so a match
  // here short-circuits it; a miss (wrong shape, or the token's value unknown)
  // falls through unchanged.
  const calcPx = resolveCalcMultipleOfToken(trimmed);
  if (calcPx !== undefined) return { kind: "literal", px: calcPx };
  // `calc(A - B * n - C * n)` — a linear combination of terms, each a known
  // token (directly, or one local-alias hop away) or a plain number. Tried
  // BEFORE the general calc() refusal below, same reasoning as the multiple-
  // of-token case just above: a miss (wrong shape, or an operand's value
  // unknown) falls through unchanged to that refusal.
  const calcLinearPx = resolveCalcLinearExpression(trimmed, localCustomProperties);
  if (calcLinearPx !== undefined) {
    // `calc(<whole> - <n> * <inset>)` keeps its shape beside the computed px, so the plan layer
    // can replace it with FILL where the parent is exactly that box (`fill-inset.ts`).
    const insetOf = parseInsetCalc(trimmed, localCustomProperties);
    return { kind: "literal", px: calcLinearPx, ...(insetOf ? { insetOf } : {}) };
  }
  const refs = varRefs(trimmed);
  if (refs.length > 0 && isBindableGeometryValue(trimmed, localCustomProperties)) {
    const variable = cssVarToFigmaVariableName(refs[refs.length - 1]);
    if (!isProjectToken(variable, refs[refs.length - 1])) {
      return { kind: "unsupported", value: trimmed };
    }
    return { kind: "variable", variable };
  }
  // The single ref (if any) is either absent, a local custom property, part of a
  // multi-ref/fallback expression, or wrapped in an unrecognised calc() — try the
  // one case `isBindableGeometryValue` deliberately excludes: a value that is
  // EXACTLY one bare `var(--local)` reference (no calc, no fallback, no second
  // term — the `SIMPLE_VAR_ALIAS_RE` shape) whose own declared value is, in turn,
  // exactly one hop from a real token. A local ref wrapped in more than that
  // (e.g. `calc(var(--switch-inline-size) - 1px)`) never reaches this branch:
  // `refs.length === 1` still holds, but the bare-shape check below fails it.
  const bareLocalAlias = SIMPLE_VAR_ALIAS_RE.exec(trimmed);
  if (bareLocalAlias && localCustomProperties.has(bareLocalAlias[1])) {
    const resolved = resolveLocalCustomPropertyAlias(bareLocalAlias[1], localCustomProperties);
    if (resolved !== null && resolved !== bareLocalAlias[1]) {
      const variable = cssVarToFigmaVariableName(resolved);
      if (!isProjectToken(variable, resolved)) return { kind: "unsupported", value: trimmed };
      return { kind: "variable", variable };
    }
  }
  return { kind: "unsupported", value: trimmed };
}

/**
 * Every `--x` this CELL's own matched-rule set declares → its own declared value
 * (its local alias) — CELL-SPECIFIC, not collected once across the whole
 * stylesheet.
 *
 * A component can declare a local custom property in its base rule and then
 * REDECLARE it inside a state rule:
 *
 *   [data-ui="switch"]                  { --switch-inline-size: var(--spacing-900); }
 *   [data-ui="switch"][data-disabled]   { --switch-inline-size: var(--spacing-800); }
 *
 * `candidates` is already the cascade-ordered (ascending specificity, ties
 * broken by source order) list of every rule that matches THIS cell — the same
 * list `resolveVariantBindings` folds through to build `bind`/`geometry` below.
 * Building the alias map from that same ordered list, rather than from every
 * rule in the stylesheet, means: (1) only declarations that actually apply to
 * this cell are considered — a state-only redeclaration never leaks into a
 * cell that doesn't match that state — and (2) iterating in cascade order and
 * overwriting on each match reproduces "last (highest-specificity/most-recent)
 * declaration wins", so a `[data-disabled]` cell resolves the state-specific
 * value while every other cell keeps the base one.
 */
function collectLocalCustomPropertiesForCell(
  candidates: readonly CandidateRule[],
): Map<string, string> {
  const local = new Map<string, string>();
  for (const candidate of candidates) {
    for (const declaration of candidate.declarations) {
      if (declaration.property.startsWith("--")) local.set(declaration.property, declaration.value);
    }
  }
  return local;
}

function collectAmbientCustomPropertiesForCell(
  entry: ComponentRegistryEntry,
  knownParts: ReadonlySet<string>,
  fragmentIndex: FragmentIndex,
  key: Record<string, string>,
  ownCandidates: readonly CandidateRule[],
  /** The cell's rendered structure, so a part another pointer target shadows is not hovered here either. */
  structure?: CellStructure,
): Map<string, string> {
  const local = new Map<string, string>();
  for (const part of entry.parts) {
    if (part === entry.rootPart) continue; // Own candidates are applied last, below.
    const partCandidates: CandidateRule[] = [];
    entry.cssRules.forEach((rule, sourceIndex) => {
      const candidate = matchRuleForCell(
        rule,
        part,
        knownParts,
        fragmentIndex,
        key,
        sourceIndex,
        undefined,
        undefined,
        rootContext(entry),
        structure,
      );
      if (candidate) partCandidates.push(candidate);
    });
    partCandidates.sort((a, b) => a.specificity - b.specificity || a.sourceIndex - b.sourceIndex);
    for (const [name, value] of collectLocalCustomPropertiesForCell(partCandidates)) {
      local.set(name, value);
    }
  }
  for (const [name, value] of collectLocalCustomPropertiesForCell(ownCandidates)) {
    local.set(name, value);
  }
  return local;
}

/**
 * The `flex-grow` factor, from `flex-grow: <n>` or the first component of the
 * `flex` shorthand (`flex: 1 1 auto` -> 1, `flex: none` -> 0, `flex: auto` -> 1).
 * Anything non-numeric or negative reads as 0 — no growth, so no fill.
 */
function parseFlexGrow(value: string): number {
  const first = value.trim().split(/\s+/)[0] ?? "";
  if (first === "none") return 0;
  if (first === "auto" || first === "initial") return first === "auto" ? 1 : 0;
  const parsed = Number.parseFloat(first);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export const PAINT_OR_TEXT_CSS_PROPERTIES: ReadonlySet<string> = new Set([
  "background",
  "background-color",
  "color",
  "border",
  "border-color",
  "stroke",
  "outline",
  "outline-color",
  "box-shadow",
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
]);

type PaddingSide = "top" | "right" | "bottom" | "left";

const PADDING_SIDE_KEYS: Record<PaddingSide, keyof ResolvedGeometry> = {
  top: "paddingTop",
  right: "paddingRight",
  bottom: "paddingBottom",
  left: "paddingLeft",
};

/** Opposite sides, and the symmetric key each axis collapses to. */
const PADDING_AXES: ReadonlyArray<{
  sides: readonly [PaddingSide, PaddingSide];
  symmetric: "paddingInline" | "paddingBlock";
}> = [
  { sides: ["left", "right"], symmetric: "paddingInline" },
  { sides: ["top", "bottom"], symmetric: "paddingBlock" },
];

const PADDING_LONGHAND_SIDES: Record<string, readonly PaddingSide[]> = {
  "padding-top": ["top"],
  "padding-right": ["right"],
  "padding-bottom": ["bottom"],
  "padding-left": ["left"],
  "padding-block-start": ["top"],
  "padding-block-end": ["bottom"],
  "padding-inline-start": ["left"],
  "padding-inline-end": ["right"],
  "padding-block": ["top", "bottom"],
  "padding-inline": ["left", "right"],
};

/** Whether a CSS property is `padding` or one of its longhands. */
export function isPaddingProperty(property: string): boolean {
  return property === "padding" || property in PADDING_LONGHAND_SIDES;
}

/** CSS 1-4 value box shorthand → `[top, right, bottom, left]`. */
function expandBoxValues(values: string[]): [string, string, string, string] | undefined {
  switch (values.length) {
    case 1:
      return [values[0], values[0], values[0], values[0]];
    case 2:
      return [values[0], values[1], values[0], values[1]];
    case 3:
      return [values[0], values[1], values[2], values[1]];
    case 4:
      return [values[0], values[1], values[2], values[3]];
    default:
      return undefined;
  }
}

/**
 * Write one side, keeping the symmetric key and the per-side keys mutually
 * exclusive per axis: a symmetric value is split into both sides first, and a
 * pair of equal sides collapses back. `undefined` clears the side — a later CSS
 * declaration that cannot be bound (a literal, `0`, an expression) still OVERRIDES
 * an earlier bound one, so leaving the old binding in place would be wrong.
 */
function setPaddingSide(
  geometry: ResolvedGeometry,
  side: PaddingSide,
  value: string | undefined,
): void {
  const axis = PADDING_AXES.find((a) => a.sides.includes(side));
  if (!axis) return;
  const [first, second] = axis.sides;
  const state: Record<PaddingSide, string | undefined> = {
    top: geometry.paddingTop,
    right: geometry.paddingRight,
    bottom: geometry.paddingBottom,
    left: geometry.paddingLeft,
  };
  const symmetric = geometry[axis.symmetric];
  if (symmetric !== undefined) {
    state[first] = symmetric;
    state[second] = symmetric;
  }
  state[side] = value;
  delete geometry[axis.symmetric];
  delete geometry[PADDING_SIDE_KEYS[first] as "paddingLeft"];
  delete geometry[PADDING_SIDE_KEYS[second] as "paddingLeft"];
  if (state[first] !== undefined && state[first] === state[second]) {
    geometry[axis.symmetric] = state[first];
    return;
  }
  if (state[first] !== undefined)
    geometry[PADDING_SIDE_KEYS[first] as "paddingLeft"] = state[first];
  if (state[second] !== undefined)
    geometry[PADDING_SIDE_KEYS[second] as "paddingLeft"] = state[second];
}

/** One padding value → the variable it binds, or `undefined` (refused: literal, `calc()`, …). */
function resolvePaddingToken(
  token: string,
  localCustomProperties: ReadonlyMap<string, string>,
): string | undefined {
  const refs = varRefs(token);
  if (refs.length === 0) return undefined;
  if (isBindableGeometryValue(token, localCustomProperties)) {
    return cssVarToFigmaVariableName(refs[refs.length - 1]);
  }
  // The same one-hop local alias width/height and every other geometry follows.
  const bareLocalAlias = SIMPLE_VAR_ALIAS_RE.exec(token.trim());
  if (!bareLocalAlias || !localCustomProperties.has(bareLocalAlias[1])) return undefined;
  const resolved = resolveLocalCustomPropertyAlias(bareLocalAlias[1], localCustomProperties);
  if (resolved === null || resolved === bareLocalAlias[1]) return undefined;
  return cssVarToFigmaVariableName(resolved);
}

/**
 * `padding` and the physical/logical padding longhands, in cascade order (the
 * caller feeds declarations already sorted). Values are bound variables only; a
 * value that cannot be bound clears the side rather than leaving an earlier one.
 */
function applyPaddingDeclaration(
  property: string,
  value: string,
  geometry: ResolvedGeometry,
  localCustomProperties: ReadonlyMap<string, string>,
): void {
  // Newlines/tabs between tokens and a trailing `!important` are plain CSS the tokenizer
  // must not mistake for one multi-reference value.
  const normalized = value
    .replace(/\s*!important\s*$/i, "")
    .trim()
    .replace(/\s+/g, " ");
  const tokens = splitTopLevel(normalized, " ")
    .map((t) => t.trim())
    .filter(Boolean);
  let perSide: Array<[PaddingSide, string]>;
  if (property === "padding") {
    const box = expandBoxValues(tokens);
    if (!box) return; // `inherit`, empty or malformed: nothing to resolve
    perSide = [
      ["top", box[0]],
      ["right", box[1]],
      ["bottom", box[2]],
      ["left", box[3]],
    ];
  } else {
    const sides = PADDING_LONGHAND_SIDES[property];
    if (tokens.length === 0 || tokens.length > sides.length) return;
    perSide = sides.map((side, i) => [side, tokens[Math.min(i, tokens.length - 1)]]);
  }
  for (const [side, token] of perSide) {
    setPaddingSide(geometry, side, resolvePaddingToken(token, localCustomProperties));
  }
}

/** The margin shorthand and longhands → the side(s) each writes, in CSS order (LTR, like padding). */
const MARGIN_SIDES: Record<string, readonly PaddingSide[]> = {
  margin: ["top", "right", "bottom", "left"],
  "margin-top": ["top"],
  "margin-right": ["right"],
  "margin-bottom": ["bottom"],
  "margin-left": ["left"],
  "margin-block-start": ["top"],
  "margin-block-end": ["bottom"],
  "margin-inline-start": ["left"],
  "margin-inline-end": ["right"],
  "margin-block": ["top", "bottom"],
  "margin-inline": ["left", "right"],
};

const MARGIN_SIDE_KEYS: Record<
  PaddingSide,
  "marginTop" | "marginRight" | "marginBottom" | "marginLeft"
> = {
  top: "marginTop",
  right: "marginRight",
  bottom: "marginBottom",
  left: "marginLeft",
};

/** Is this CSS property a margin shorthand or longhand? */
export function isMarginProperty(property: string): boolean {
  return property in MARGIN_SIDES;
}

/**
 * Resolve one margin declaration onto the per-side margin geometry, in cascade order.
 * Each side takes its value from the shorthand's box expansion (`margin`) or the longhand's
 * own values (a two-sided logical longhand takes start then end, one value repeats). A value
 * of `0` clears the side (a reset is not a refusal). A `var()` token binds like padding does
 * (one variable, or a local alias of one). `auto`, a negative value, and anything else that
 * cannot bind (`calc()`, a px literal, a fallback `var()`) clears the side and is reported in
 * `refusedMargins` under `<part> <property>`, never approximated.
 */
function applyMarginDeclaration(
  property: string,
  value: string,
  geometry: ResolvedGeometry,
  localCustomProperties: ReadonlyMap<string, string>,
  part: string | undefined,
): void {
  // Refusals are tracked by EFFECTIVE side while the cascade runs, so a side a later declaration
  // sets or clears no longer carries the earlier refusal (`margin: auto` then `margin-top: 0`).
  let pending = pendingMarginRefusals.get(geometry);
  if (!pending) {
    pending = new Map();
    pendingMarginRefusals.set(geometry, pending);
  }
  const sides = MARGIN_SIDES[property];
  const normalized = value
    .replace(/\s*!important\s*$/i, "")
    .trim()
    .replace(/\s+/g, " ");
  const tokens = splitTopLevel(normalized, " ")
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.length === 0) return;
  let perSide: Array<[PaddingSide, string]>;
  if (property === "margin") {
    const box = expandBoxValues(tokens);
    if (!box) return;
    perSide = [
      ["top", box[0]],
      ["right", box[1]],
      ["bottom", box[2]],
      ["left", box[3]],
    ];
  } else {
    if (tokens.length > sides.length) return;
    perSide = sides.map((side, i) => [side, tokens[Math.min(i, tokens.length - 1)]]);
  }
  for (const [side, token] of perSide) {
    const key = MARGIN_SIDE_KEYS[side];
    const lowered = token.toLowerCase();
    if (/^0(?:px|rem|em)?$/.test(lowered)) {
      delete geometry[key];
      pending.delete(side);
      continue;
    }
    const reason =
      lowered === "auto"
        ? "auto margins have no Figma equivalent"
        : lowered.startsWith("-") || /^calc\(\s*-/.test(lowered)
          ? "negative margins have no Figma equivalent"
          : undefined;
    const bound = reason ? undefined : resolvePaddingToken(token, localCustomProperties);
    if (bound === undefined) {
      delete geometry[key];
      pending.set(side, [
        `${part ?? ""} ${property}`.trim(),
        `${property}: ${token} — ${reason ?? "not a single bindable token"}`,
      ]);
      continue;
    }
    geometry[key] = bound;
    pending.delete(side);
  }
}

/** Refused margin declarations still in force per side, while a part's cascade is applied. */
const pendingMarginRefusals = new WeakMap<ResolvedGeometry, Map<PaddingSide, [string, string]>>();

/**
 * Move the refusals still in force after a part's whole cascade into `refusedMargins`: a side
 * that a later declaration set or reset to `0` reports nothing.
 */
function collectMarginRefusals(
  geometry: ResolvedGeometry,
  refusedMargins: Map<string, string>,
): void {
  for (const [key, message] of pendingMarginRefusals.get(geometry)?.values() ?? []) {
    refusedMargins.set(key, message);
  }
  // Size limits, overflow, wrapping and translation refuse into the same map: it is the
  // plan's one report of CSS layout that Figma's auto-layout cannot carry exactly.
  for (const [key, message] of pendingLayoutRefusals.get(geometry)?.values() ?? []) {
    refusedMargins.set(key, message);
  }
  // A percentage inset only places a box that is positioned out of flow.
  if (!absolutelyPositioned.has(geometry)) delete geometry.insetPercent;
  const anchorMinimum = minWidthFromAnchor.get(geometry);
  if (anchorMinimum) {
    // The popup fills the column it shares with its anchor, so it is never narrower than the
    // anchor and still widens with its own content. A width the stylesheet also states would
    // need both at once, which Figma cannot hold, so that case stays a reported refusal.
    if (geometry.width === undefined) geometry.width = { kind: "fill" };
    else refusedMargins.set(anchorMinimum[0], anchorMinimum[1]);
  }
}

type BorderSide = PaddingSide;

const BORDER_SIDE_KEYS: Record<BorderSide, keyof ResolvedGeometry> = {
  top: "borderTopWidth",
  right: "borderRightWidth",
  bottom: "borderBottomWidth",
  left: "borderLeftWidth",
};

const BORDER_SIDE_BASES: Record<string, readonly BorderSide[]> = {
  "border-top": ["top"],
  "border-right": ["right"],
  "border-bottom": ["bottom"],
  "border-left": ["left"],
  "border-block-start": ["top"],
  "border-block-end": ["bottom"],
  "border-inline-start": ["left"],
  "border-inline-end": ["right"],
  "border-block": ["top", "bottom"],
  "border-inline": ["left", "right"],
};

/**
 * The strength of a colour mixed with `transparent`, as a fraction (`0.15`), or `undefined` when
 * the value is no such mix or the strength is not known. The strength is a percentage, written
 * out (`15%`) or as a token (`calc(var(--opacity-strong) * 100%)`) whose value the build loaded.
 */
export function alphaOf(value: string): number | undefined {
  if (!/color-mix\(/i.test(value) || !/\btransparent\b/i.test(value)) return undefined;
  const mix =
    /var\(\s*--[\w-]+\s*\)\s+(?:calc\(\s*var\(\s*(--[\w-]+)\s*\)\s*\*\s*100%\s*\)|(\d+(?:\.\d+)?)%)/i.exec(
      value,
    );
  if (!mix) return undefined;
  if (mix[2] !== undefined) return Number(mix[2]) / 100;
  const token = _resolvedTokenPxValues?.get(normalizeVariableName(mix[1].replace(/^--/, "")));
  return token !== undefined && token >= 0 && token <= 1 ? token : undefined;
}

/**
 * The all-sides `border` shorthand's width, as the bound stroke weight: a single token is bound,
 * and `0`, `none` or a width that cannot be bound clears an earlier one, since the later
 * declaration wins. Without it every stroked variant would keep Figma's default weight.
 */
function applyBorderShorthandWidth(
  value: string,
  geometry: ResolvedGeometry,
  localCustomProperties: ReadonlyMap<string, string>,
): void {
  const tokens = splitTopLevel(value.replace(/\s*!important\s*$/i, "").trim(), " ")
    .map((t) => t.trim())
    .filter(Boolean);
  const hidden = tokens.some((t) => t === "none" || t === "hidden");
  const widthToken = tokens.find(
    (t) =>
      !BORDER_STYLE_KEYWORDS.has(t) &&
      !t.startsWith("color-mix(") &&
      lastColorVarRef(t) === undefined &&
      t !== "transparent",
  );
  const bound = widthToken ? resolvePaddingToken(widthToken, localCustomProperties) : undefined;
  if (hidden || bound === undefined) delete geometry.borderWidth;
  else geometry.borderWidth = bound;
}

type BorderSideForm = { sides: readonly BorderSide[]; part: "shorthand" | "width" | "color" };

const BORDER_SIDE_PROPERTIES: Record<string, BorderSideForm> = {};
for (const [base, sides] of Object.entries(BORDER_SIDE_BASES)) {
  BORDER_SIDE_PROPERTIES[base] = { sides, part: "shorthand" };
  BORDER_SIDE_PROPERTIES[`${base}-width`] = { sides, part: "width" };
  BORDER_SIDE_PROPERTIES[`${base}-color`] = { sides, part: "color" };
}

/** Whether a CSS property is a per-side border shorthand. */
export function isBorderSideProperty(property: string): boolean {
  return property in BORDER_SIDE_PROPERTIES;
}

const BORDER_STYLE_KEYWORDS = new Set([
  "none",
  "hidden",
  "solid",
  "dashed",
  "dotted",
  "double",
  "groove",
  "ridge",
  "inset",
  "outset",
]);

/**
 * `border-<side>`, its logical forms and their `-width`/`-color` longhands, in cascade
 * order (the caller feeds declarations already sorted). The width is a bound variable
 * only; `0`, `none`/`hidden`, or a width that cannot be bound clears the side, because a
 * later declaration still OVERRIDES an earlier bound one. The colour binds the node's
 * single stroke, like the all-sides `border-color`.
 */
function applyBorderSideDeclaration(
  property: string,
  value: string,
  bind: ResolvedVariantBinding,
  geometry: ResolvedGeometry,
  localCustomProperties: ReadonlyMap<string, string>,
): void {
  const form = BORDER_SIDE_PROPERTIES[property];
  const normalized = value
    .replace(/\s*!important\s*$/i, "")
    .trim()
    .replace(/\s+/g, " ");
  const tokens = splitTopLevel(normalized, " ")
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.length === 0) return;

  if (form.part !== "color") {
    // A colour reference (also nested, as in `color-mix(..., var(--color-x) 80%, ...)`)
    // is never a width.
    const widthTokens = tokens.filter(
      (t) =>
        !BORDER_STYLE_KEYWORDS.has(t) && lastColorVarRef(t) === undefined && t !== "transparent",
    );
    const hidden = tokens.some((t) => t === "none" || t === "hidden");
    // `border-bottom: solid var(--color-x)` names no width: the CSS default (medium) is
    // not a design value, so it clears like any other width that cannot be bound.
    // Two-value logical widths (`border-inline-width: a b`) are start then end; one value
    // repeats for both sides.
    for (const [index, side] of form.sides.entries()) {
      const widthToken = widthTokens[Math.min(index, widthTokens.length - 1)];
      const bound = widthToken ? resolvePaddingToken(widthToken, localCustomProperties) : undefined;
      const key = BORDER_SIDE_KEYS[side] as "borderTopWidth";
      if (hidden || bound === undefined) delete geometry[key];
      else geometry[key] = bound;
    }
  }
  if (form.part !== "width") {
    const colorRef = lastColorVarRef(normalized);
    if (colorRef) bind.stroke = cssVarToFigmaVariableName(colorRef);
  }
}

// ---------------------------------------------------------------------------
// Size limits, overflow, wrapping, translation and percentage insets.
//
// Each maps to a Figma auto-layout property only when the CSS is exact for it, and is otherwise
// refused and reported in `refusedMargins` under `<part> <property>` (the release bar reads that
// map). A refusal is tracked per property while the cascade runs, so a later declaration that
// resolves (or resets) the same property no longer carries the earlier refusal.
// ---------------------------------------------------------------------------

type SizeLimitKey = "minWidth" | "maxWidth" | "minHeight" | "maxHeight";

const SIZE_LIMIT_PROPERTIES: Record<string, SizeLimitKey> = {
  "min-width": "minWidth",
  "min-inline-size": "minWidth",
  "max-width": "maxWidth",
  "max-inline-size": "maxWidth",
  "min-height": "minHeight",
  "min-block-size": "minHeight",
  "max-height": "maxHeight",
  "max-block-size": "maxHeight",
};

/**
 * `min-width: var(--anchor-width[, <fallback>])`: Base UI measures the anchor element and writes
 * its width onto the popup, so the popup is at least as wide as its anchor. The fallback is never
 * what renders while the popup is anchored, so it is not a number to bake in either.
 */
const ANCHOR_WIDTH_MIN_RE = /^var\(\s*--anchor-width\s*(?:,[^)]*)?\)$/;

/**
 * Geometries whose cascade ends with an anchor-width minimum, with the refusal to report if the
 * part also states a width (see `collectMarginRefusals`).
 */
const minWidthFromAnchor = new WeakMap<ResolvedGeometry, [string, string]>();

/** Refused layout declarations still in force, by effective property, while a part's cascade is applied. */
const pendingLayoutRefusals = new WeakMap<ResolvedGeometry, Map<string, [string, string]>>();
/** Geometries whose cascade declared `position: absolute | fixed`. */
const absolutelyPositioned = new WeakSet<ResolvedGeometry>();

/** The layout refusals recorded so far against a geometry, created on first use. */
function layoutRefusalsOf(geometry: ResolvedGeometry): Map<string, [string, string]> {
  let pending = pendingLayoutRefusals.get(geometry);
  if (!pending) {
    pending = new Map();
    pendingLayoutRefusals.set(geometry, pending);
  }
  return pending;
}

/**
 * Records that a layout declaration cannot be mapped exactly, with the slot, part, property and
 * reason.
 */
function refuseLayout(
  geometry: ResolvedGeometry,
  slot: string,
  part: string | undefined,
  property: string,
  value: string,
  reason: string,
): void {
  layoutRefusalsOf(geometry).set(slot, [
    `${part ?? ""} ${property}`.trim(),
    `${property}: ${value} — ${reason}`,
  ]);
}

/**
 * Trims a CSS value, removing `!important` and collapsing whitespace, so equal values compare
 * equal.
 */
const normalizeLayoutValue = (value: string): string =>
  value
    .replace(/\s*!important\s*$/i, "")
    .trim()
    .replace(/\s+/g, " ");

/**
 * `min-*`/`max-*` → Figma's `minWidth`/`maxWidth`/`minHeight`/`maxHeight`. One bare token binds
 * (directly or through one local alias); a px literal is the `*Px` number. A zero lower bound,
 * `auto`, and `none` state no limit. `calc()`, `min()`/`max()`, viewport and percentage units,
 * `rem`, and a `var()` with a fallback (a runtime value) are refused, never baked to a number.
 * The one runtime value with a Figma equivalent is the anchor's width as a minimum width: it
 * becomes a fill of the column the popup shares with its anchor (`collectMarginRefusals`).
 */
function applySizeLimitDeclaration(
  key: SizeLimitKey,
  property: string,
  value: string,
  geometry: ResolvedGeometry,
  localCustomProperties: ReadonlyMap<string, string>,
  part: string | undefined,
): void {
  const pxKey = `${key}Px` as `${SizeLimitKey}Px`;
  delete geometry[key];
  delete geometry[pxKey];
  layoutRefusalsOf(geometry).delete(key);
  const trimmed = normalizeLayoutValue(value);
  if (key === "minWidth") {
    minWidthFromAnchor.delete(geometry);
    if (ANCHOR_WIDTH_MIN_RE.test(trimmed)) {
      minWidthFromAnchor.set(geometry, [
        `${part ?? ""} ${property}`.trim(),
        `${property}: ${trimmed} — the anchor's width and the stated width cannot both hold in Figma`,
      ]);
      return;
    }
  }
  const isMin = key.startsWith("min");
  if (isMin ? trimmed === "auto" || /^0(?:px)?$/.test(trimmed) : trimmed === "none") return;
  const literal = LITERAL_PX_RE.exec(trimmed);
  if (literal) {
    const px = Number(literal[1]);
    // A zero lower bound states no limit; a zero upper bound (or any non-positive value) is not a
    // limit Figma can hold, so it falls through to the refusal below.
    if (isMin && px === 0) return;
    if (Number.isFinite(px) && px > 0) {
      geometry[pxKey] = px;
      return;
    }
  }
  if (/^var\(\s*--[a-zA-Z0-9-]+\s*\)$/.test(trimmed)) {
    // The resolved CSS identifier (through one local alias) is what is checked, so a Base UI
    // runtime dimension (`--available-height`) is refused even when no token set was injected.
    const ref = varRefs(trimmed)[0];
    const variable =
      ref === undefined ? undefined : tokenVariableForRef(ref, localCustomProperties);
    if (variable !== undefined) {
      geometry[key] = variable;
      return;
    }
  }
  refuseLayout(
    geometry,
    key,
    part,
    property,
    trimmed,
    "not one token or a finite positive px literal, so Figma's limit cannot carry it exactly",
  );
}

/**
 * `overflow: hidden | clip` (one keyword, or the same one on both axes) → `clipsContent`. Every
 * other `overflow` value clears it: `visible` is the default, and a scroll container (`auto`,
 * `scroll`) is not a clipping frame, so there is no Figma property to carry and nothing to refuse.
 * A single-axis longhand (`overflow-y`) is left alone: it neither sets nor clears the clip.
 */
function applyOverflowDeclaration(
  property: string,
  value: string,
  geometry: ResolvedGeometry,
): void {
  if (property !== "overflow") return;
  delete geometry.clipsContent;
  const words = normalizeLayoutValue(value).split(" ");
  const single = words.length === 2 && words[0] === words[1] ? words[0] : words.join(" ");
  if (single === "hidden" || single === "clip") geometry.clipsContent = true;
}

/** `flex-wrap: wrap` → `layoutWrap`; `wrap-reverse` has no Figma equivalent and is refused. */
function applyFlexWrapDeclaration(
  value: string,
  geometry: ResolvedGeometry,
  part: string | undefined,
): void {
  delete geometry.layoutWrap;
  layoutRefusalsOf(geometry).delete("flex-wrap");
  const trimmed = normalizeLayoutValue(value);
  if (trimmed === "wrap") geometry.layoutWrap = "WRAP";
  else if (trimmed !== "nowrap") {
    refuseLayout(geometry, "flex-wrap", part, "flex-wrap", trimmed, "no Figma equivalent");
  }
}

/** `row-gap`: one bound token, `0`/`normal` for none; anything else is refused. */
function applyRowGapDeclaration(
  value: string,
  geometry: ResolvedGeometry,
  localCustomProperties: ReadonlyMap<string, string>,
  part: string | undefined,
): void {
  delete geometry.rowGap;
  layoutRefusalsOf(geometry).delete("row-gap");
  const trimmed = normalizeLayoutValue(value);
  if (trimmed === "normal" || /^0(?:px)?$/.test(trimmed)) return;
  const bound = resolvePaddingToken(trimmed, localCustomProperties);
  if (bound === undefined) {
    refuseLayout(geometry, "row-gap", part, "row-gap", trimmed, "not a single bindable token");
    return;
  }
  geometry.rowGap = bound;
}

/**
 * `transform: translateX(<px | token | linear calc of tokens>)` → `translateXPx`, resolved against
 * the tokens in force (an intermediate: `translate-to-align.ts` decides whether it is exactly an
 * alignment). `none` and a zero translation carry nothing. A transform with no `translateX`
 * (`scale()`, `rotate()`) states no horizontal shift and is left alone, as before.
 */
function applyTransformDeclaration(
  value: string,
  geometry: ResolvedGeometry,
  localCustomProperties: ReadonlyMap<string, string>,
  part: string | undefined,
): void {
  delete geometry.translateXPx;
  layoutRefusalsOf(geometry).delete("transform");
  const trimmed = normalizeLayoutValue(value);
  const match = /^translateX\(\s*(.+)\s*\)$/.exec(trimmed);
  if (!match) return;
  const inner = match[1].trim();
  let px: number | undefined;
  if (/^0(?:px)?$/.test(inner)) px = 0;
  else if (LITERAL_PX_RE.test(inner)) px = Number(LITERAL_PX_RE.exec(inner)?.[1]);
  else if (/^calc\(/.test(inner)) px = resolveCalcLinearExpression(inner, localCustomProperties);
  if (px === undefined) {
    refuseLayout(
      geometry,
      "transform",
      part,
      "transform",
      trimmed,
      "a translation that is not a px literal or a linear calc of known tokens cannot be placed exactly",
    );
    return;
  }
  if (px !== 0) geometry.translateXPx = px;
}

const INSET_SIDES: Record<string, Array<"top" | "right" | "bottom" | "left">> = {
  top: ["top"],
  right: ["right"],
  bottom: ["bottom"],
  left: ["left"],
  "inset-inline-start": ["left"],
  "inset-inline-end": ["right"],
  "inset-block-start": ["top"],
  "inset-block-end": ["bottom"],
  "inset-inline": ["left", "right"],
  "inset-block": ["top", "bottom"],
};

const PERCENT_RE = /^(-?\d+(?:\.\d+)?)%$/;

/** Percentage insets on a positioned box, per side, recorded for `inset-constraints.ts`. */
function applyInsetDeclaration(property: string, value: string, geometry: ResolvedGeometry): void {
  const tokens = normalizeLayoutValue(value).split(" ").filter(Boolean);
  let perSide: Array<["top" | "right" | "bottom" | "left", string]>;
  if (property === "inset") {
    const box = expandBoxValues(tokens);
    if (!box) return;
    perSide = [
      ["top", box[0]],
      ["right", box[1]],
      ["bottom", box[2]],
      ["left", box[3]],
    ];
  } else {
    const sides = INSET_SIDES[property];
    if (!sides || tokens.length === 0 || tokens.length > sides.length) return;
    perSide = sides.map((side, i) => [side, tokens[Math.min(i, tokens.length - 1)]]);
  }
  const next = { ...(geometry.insetPercent ?? {}) };
  for (const [side, token] of perSide) {
    const percent = PERCENT_RE.exec(token);
    if (percent) next[side] = Number(percent[1]);
    else delete next[side];
  }
  if (Object.keys(next).length > 0) geometry.insetPercent = next;
  else delete geometry.insetPercent;
}

/**
 * Applies one CSS declaration to a variant's bindings and geometry, recording what it cannot map.
 */
function applyDeclaration(
  property: string,
  value: string,
  bind: ResolvedVariantBinding,
  geometry: ResolvedGeometry,
  localCustomProperties: ReadonlyMap<string, string>,
  part?: string,
): void {
  const sizeLimit = SIZE_LIMIT_PROPERTIES[property];
  if (sizeLimit) {
    applySizeLimitDeclaration(sizeLimit, property, value, geometry, localCustomProperties, part);
    return;
  }
  if (property === "overflow" || property === "overflow-x" || property === "overflow-y") {
    applyOverflowDeclaration(property, value, geometry);
    return;
  }
  if (property === "flex-wrap") {
    applyFlexWrapDeclaration(value, geometry, part);
    return;
  }
  if (property === "row-gap") {
    applyRowGapDeclaration(value, geometry, localCustomProperties, part);
    return;
  }
  if (property === "transform") {
    applyTransformDeclaration(value, geometry, localCustomProperties, part);
    return;
  }
  // The `gap` shorthand sets the row gap too, so a later `gap` supersedes an earlier `row-gap`.
  // It carries on to the generic token binding below.
  if (property === "gap") {
    delete geometry.rowGap;
    layoutRefusalsOf(geometry).delete("row-gap");
  }
  if (property === "position") {
    const kind = normalizeLayoutValue(value);
    if (kind === "absolute" || kind === "fixed") absolutelyPositioned.add(geometry);
    else absolutelyPositioned.delete(geometry);
    return;
  }
  if (property === "inset" || Object.hasOwn(INSET_SIDES, property)) {
    applyInsetDeclaration(property, value, geometry);
    return;
  }
  // Margins: per-side bound tokens, in cascade order (see `applyMarginDeclaration`).
  if (isMarginProperty(property)) {
    applyMarginDeclaration(property, value, geometry, localCustomProperties, part);
    return;
  }
  // `stroke: currentColor` carries no `var()` but is a real answer: the stroke follows the
  // part's text colour (see `ResolvedVariantBinding.strokeFromText`).
  if (property === "stroke") {
    if (value.trim().toLowerCase() === "currentcolor") {
      delete bind.stroke;
      bind.strokeFromText = true;
      return;
    }
    // Any other `stroke` replaces an earlier `currentColor`; a literal (`none`, a colour) binds nothing
    // and also replaces an earlier bound stroke. A `var()` is bound by the branch below.
    delete bind.strokeFromText;
    if (varRefs(value).length === 0) {
      delete bind.stroke;
      return;
    }
  }
  // Padding is classified before the no-var early return too: `padding: 0` carries no
  // `var()` but still overrides an earlier bound value.
  if (isPaddingProperty(property)) {
    applyPaddingDeclaration(property, value, geometry, localCustomProperties);
    return;
  }
  // One-sided borders likewise: `border-bottom: 0` carries no `var()` yet clears a side.
  if (isBorderSideProperty(property)) {
    applyBorderSideDeclaration(property, value, bind, geometry, localCustomProperties);
    return;
  }
  // An all-sides `border` / `border-width` declared later in the cascade overrides every
  // earlier per-side width. Cleared before the literal-value guard below, so `border: 0`
  // clears too; the all-sides handling itself then continues unchanged.
  if (property === "border" || property === "border-width") {
    for (const side of Object.keys(BORDER_SIDE_KEYS) as BorderSide[]) {
      delete geometry[BORDER_SIDE_KEYS[side] as "borderTopWidth"];
    }
  }

  // Dimensions are classified BEFORE the no-var early return: `100%`, `16px` and
  // `auto` carry no `var()` yet are all real answers about the node's box.
  const dimensionKey = GEOMETRY_PROPERTIES[property];
  if (dimensionKey === "width" || dimensionKey === "height") {
    geometry[dimensionKey] = parseDimension(value, localCustomProperties);
    return;
  }

  if (property === "flex" || property === "flex-grow") {
    if (parseFlexGrow(value) > 0) geometry.growsOnMainAxis = true;
    return;
  }
  if (property === "flex-direction") {
    const mapped = mapFlexDirection(value);
    if (mapped) geometry.layoutMode = mapped;
    return;
  }
  if (property === "align-items") {
    const mapped = mapAlignItems(value);
    if (mapped) geometry.counterAxisAlignItems = mapped;
    if (value.trim() === "stretch") geometry.alignItems = "stretch";
    return;
  }
  if (property === "align-self") {
    // Parent-relative like `flex-grow`: a real answer with no `var()` in it.
    const mapped = mapAlignItems(value);
    if (mapped && value.trim() !== "stretch") geometry.alignSelf = mapped;
    else delete geometry.alignSelf;
    return;
  }
  if (property === "justify-content") {
    const mapped = mapJustifyContent(value);
    if (mapped) geometry.primaryAxisAlignItems = mapped;
    return;
  }
  if (property === "text-align") {
    const mapped = mapTextAlign(value);
    if (mapped) geometry.textAlignHorizontal = mapped;
    return;
  }
  if (property === "text-transform") {
    const mapped = mapTextTransform(value);
    if (mapped) geometry.textCase = mapped;
    return;
  }

  // A computed radius (`calc()`/`min()`/`max()`/`clamp()`, including the nested-corner rule
  // `max(0px, var(--inner-radius, …))`) binds the brand's default radius, consistently, and is
  // reported, even when it could be evaluated to px: a baked literal would not follow the brand.
  if (property === "border-radius") {
    // A later radius declaration supersedes an earlier computed-radius fallback.
    pendingRadiusFallbacks.delete(geometry);
    if (isComputedRadius(value, localCustomProperties)) {
      geometry.radius = cssVarToFigmaVariableName(COMPUTED_RADIUS_FALLBACK_TOKEN);
      delete geometry.radiusPx;
      pendingRadiusFallbacks.set(
        geometry,
        `border-radius: ${value.trim().replace(/\s+/g, " ")} — computed, so it cannot bind a ` +
          `single variable; bound to the brand's default radius (${COMPUTED_RADIUS_FALLBACK_TOKEN}) instead.`,
      );
      return;
    }
  }

  const refs = varRefs(value);
  if (refs.length === 0) return;

  // A colour mixed with `transparent` is the token at a fraction of its strength. The paint binds
  // the token's colour and carries that fraction as its opacity; without it the token would paint
  // at full strength (a label's own colour as the fill under it, which hides the label). A later
  // declaration replaces the earlier opacity along with the earlier colour.
  const alpha = alphaOf(value);
  if (property === "background-color" || property === "background") {
    bind.fill = cssVarToFigmaVariableName(refs[0]);
    if (alpha === undefined) delete bind.fillOpacity;
    else bind.fillOpacity = alpha;
    return;
  }
  if (property === "color") {
    bind.text = cssVarToFigmaVariableName(refs[0]);
    return;
  }
  if (property === "border-color") {
    bind.stroke = cssVarToFigmaVariableName(refs[0]);
    if (alpha === undefined) delete bind.strokeOpacity;
    else bind.strokeOpacity = alpha;
    return;
  }
  if (property === "stroke") {
    // SVG paint on a stroked shape — Figma's stroke, like `border-color`.
    bind.stroke = cssVarToFigmaVariableName(refs[0]);
    delete bind.strokeOpacity;
    delete bind.strokeFromText;
    return;
  }
  if (property === "border") {
    applyBorderShorthandWidth(value, geometry, localCustomProperties);
    const colorRef = lastColorVarRef(value);
    if (colorRef) {
      bind.stroke = cssVarToFigmaVariableName(colorRef);
      if (alpha === undefined) delete bind.strokeOpacity;
      else bind.strokeOpacity = alpha;
    }
    return;
  }
  if (property === "outline" || property === "outline-color") {
    const colorRef = lastColorVarRef(value);
    if (colorRef) bind.stroke = cssVarToFigmaVariableName(colorRef);
    return;
  }
  if (property === "box-shadow") {
    const result = deriveEffectStyle(value);
    if (result.kind === "effectStyle") {
      bind.effectStyle = result.effectStyle;
      if (result.ring) {
        bind.stroke = result.ring.color;
        geometry.borderWidth = result.ring.width;
      }
    } else if (result.kind === "ring") {
      bind.stroke = result.ring.color;
      geometry.borderWidth = result.ring.width;
    }
    return;
  }
  // Every remaining geometry key is a plain variable name — width/height and
  // every alignment/direction property (flex-direction, align-items,
  // justify-content, text-align) are all handled above and returned already;
  // `GEOMETRY_PROPERTIES` has no entry for any of them, so `dimensionKey` is
  // never one of those keys at runtime (the `GeometryMapKey` exclusion above
  // is for the type checker, which can't see that GEOMETRY_PROPERTIES is closed).
  if (dimensionKey) {
    // A later token/alias radius supersedes an earlier computed literal.
    if (dimensionKey === "radius") delete geometry.radiusPx;
    // Geometry only — a paint's `calc()` sits inside a `color-mix()` alpha term
    // while its colour var is still perfectly bindable, so the same guard there
    // would drop real bindings.
    if (isBindableGeometryValue(value, localCustomProperties)) {
      geometry[dimensionKey] = cssVarToFigmaVariableName(refs[refs.length - 1]);
      return;
    }
    // The same one-hop local alias `parseDimension` follows for width/height:
    // Controls declare `--ctl-padding-x: var(--control-padding-x-md)` per size and
    // read it back bare (`padding-inline: var(--ctl-padding-x)`). Only that exact
    // shape is followed; anything richer stays refused.
    const bareLocalAlias = SIMPLE_VAR_ALIAS_RE.exec(value.trim());
    if (!bareLocalAlias || !localCustomProperties.has(bareLocalAlias[1])) return;
    const resolved = resolveLocalCustomPropertyAlias(bareLocalAlias[1], localCustomProperties);
    if (resolved === null || resolved === bareLocalAlias[1]) return;
    geometry[dimensionKey] = cssVarToFigmaVariableName(resolved);
  }
}

/**
 * PURE. Resolve fill/text/stroke + geometry bindings for every cell of
 * `axes` (default: the registry entry's own axes) against the entry's CSS.
 */
export function resolveVariantBindings(
  entry: ComponentRegistryEntry,
  axes: ComponentRegistryAxis[] = entry.axes,
): ResolvedVariantCell[] {
  return resolveVariantBindingsWithRefusals(entry, axes).cells;
}

export interface ResolveVariantBindingsResult {
  cells: ResolvedVariantCell[];
  refusedNegations: Map<string, string>;
  /**
   * Margins this component's CSS declares on the resolved part that cannot be carried as a
   * bound token (`auto`, negative, `calc()`, a literal): keyed `<part> <property>`, mapped to
   * the property, value and reason. Empty when every margin binds or is `0`.
   */
  refusedMargins: Map<string, string>;
  /**
   * Corners whose radius is computed (`calc()`/`min()`/`max()`/`clamp()`, or a local custom
   * property declared that way) and could not resolve to px: keyed `<part> border-radius`,
   * mapped to the CSS and the fallback. Each is bound to the brand's default radius
   * (`COMPUTED_RADIUS_FALLBACK_TOKEN`). A diagnostic, not a refusal: the corner is bound.
   */
  radiusFallbacks: Map<string, string>;
}

export function resolveVariantBindingsWithRefusals(
  entry: ComponentRegistryEntry,
  axes: ComponentRegistryAxis[] = entry.axes,
  /** The contract's anatomy, which lets `:has()` and position pseudo-classes be evaluated. */
  anatomy?: ResolveAnatomy,
): ResolveVariantBindingsResult {
  const fragmentIndex = buildFragmentIndex(axes);
  const cells = cartesian(axes);
  const knownParts = new Set([entry.rootPart, ...entry.parts]);
  const pointerTargets = pointerTargetParts(entry.cssRules);
  const refusedNegations = new Map<string, string>();
  const refusedMargins = new Map<string, string>();
  const radiusFallbacks = new Map<string, string>();

  const resolvedCells = cells.map((key) => {
    const candidates: CandidateRule[] = [];
    const structure = structureForCell(anatomy, key, fragmentIndex, pointerTargets);
    entry.cssRules.forEach((rule, sourceIndex) => {
      const candidate = matchRuleForCell(
        rule,
        entry.rootPart,
        knownParts,
        fragmentIndex,
        key,
        sourceIndex,
        undefined,
        refusedNegations,
        rootContext(entry),
        structure,
      );
      if (candidate) candidates.push(candidate);
    });

    // Cascade: sort by specificity ascending (stable sort preserves source
    // order for ties, matching the browser rule "equal specificity → last wins").
    candidates.sort((a, b) => a.specificity - b.specificity || a.sourceIndex - b.sourceIndex);

    // CELL-SPECIFIC alias map: built from every part's matched-rule set for
    // THIS cell (same cascade order used below, own rootPart wins ties), not
    // from the whole stylesheet regardless of cell — see
    // `collectAmbientCustomPropertiesForCell`.
    const localCustomProperties = collectAmbientCustomPropertiesForCell(
      entry,
      knownParts,
      fragmentIndex,
      key,
      candidates,
      structure,
    );

    const bind: ResolvedVariantBinding = {};
    const geometry: ResolvedGeometry = {};
    for (const decl of cascadeDeclarations(candidates)) {
      applyDeclaration(
        decl.property,
        decl.value,
        bind,
        geometry,
        localCustomProperties,
        entry.rootPart,
      );
    }
    collectMarginRefusals(geometry, refusedMargins);
    collectRadiusFallbacks(geometry, radiusFallbacks, entry.rootPart);
    const textStyleResult = deriveTextStyle(geometry);
    if (textStyleResult.kind === "textStyle") {
      geometry.textStyle = textStyleResult.textStyle;
      // Clear per-property font refs — textStyle supersedes them
      delete geometry.fontFamily;
      delete geometry.fontSize;
      delete geometry.fontWeight;
      delete geometry.lineHeight;
      delete geometry.letterSpacing;
    }

    return { key, bind: withSortedKeys(bind), geometry: withSortedKeys(geometry) };
  });

  return { cells: resolvedCells, refusedNegations, refusedMargins, radiusFallbacks };
}

export type PseudoElementSuffix = "::before" | "::after";

export type ResolvePseudoPartResult =
  | {
      kind: "resolved";
      cells: ResolvedVariantCell[];
      /** Margins that could not bind, keyed `<part> <property>` like an ordinary part's. */
      refusedMargins: Map<string, string>;
      /** Computed radii bound to the default radius, keyed `<part> border-radius`. */
      radiusFallbacks: Map<string, string>;
    }
  | { kind: "refused"; reason: string };

/** CSS `rotate` values that are a no-op — anything else is an actual rotation. */
const ROTATE_NONE_VALUES = new Set(["0", "0deg", "none"]);

/** The target compound of one selector, if it names `hostPart` and carries `pseudo`. */
function targetsPseudoElement(
  selector: string,
  hostPart: string,
  pseudo: PseudoElementSuffix,
): boolean {
  const parsedCompounds = parseSelectorCompounds(selector);
  const parsed = parsedCompounds.at(-1);
  if (!parsed) return false;
  const rootAttr = parsed.attributes.find((attr) => attr.name === "data-ui");
  return rootAttr?.value === hostPart && parsed.pseudos.includes(pseudo);
}

export function hasPseudoElementRule(
  entry: ComponentRegistryEntry,
  hostPart: string,
  pseudo: PseudoElementSuffix,
): boolean {
  return entry.cssRules.some((rule) =>
    rule.selectors.some((selector) => targetsPseudoElement(selector, hostPart, pseudo)),
  );
}

/**
 * PURE. Resolve one pseudo-element anatomy part's bindings/geometry across
 * every cell of `axes`, from the SAME component CSS `entry` already carries.
 * Mirrors `resolveVariantBindings`'s cascade, keyed on the host part's own
 * selectors/axes, with the pseudo-element-specific handling documented above.
 */
export function resolvePseudoPart(
  entry: ComponentRegistryEntry,
  hostPart: string,
  pseudo: PseudoElementSuffix,
  axes: ComponentRegistryAxis[] = entry.axes,
): ResolvePseudoPartResult {
  const matchingRules = entry.cssRules.filter((rule) =>
    rule.selectors.some((selector) => targetsPseudoElement(selector, hostPart, pseudo)),
  );
  if (matchingRules.length === 0) {
    return {
      kind: "refused",
      reason: `no CSS rule targets [data-ui="${hostPart}"]${pseudo} in this component's stylesheet.`,
    };
  }

  // Rotation is refused UNCONDITIONALLY, before any per-cell cascade work:
  // whether or not this resolver can VERIFY which cells the rule applies to
  // (an attribute it doesn't model as an axis, e.g. a boolean trigger prop,
  // conservatively never matches any cell — see `matchRuleForCell`), the CSS
  // still says "rotate this", and that must be reported, not silently
  // invisible because the cascade match happened to come up empty.
  for (const rule of matchingRules) {
    const rotateDecl = rule.declarations.find((d) => d.property === "rotate");
    if (rotateDecl && !ROTATE_NONE_VALUES.has(rotateDecl.value.trim().toLowerCase())) {
      return {
        kind: "refused",
        reason:
          `rotate: ${rotateDecl.value.trim()} on [data-ui="${hostPart}"]${pseudo} has no Figma ` +
          "equivalent — a rotated border-only shape (e.g. a two-sided-border chevron) can't be " +
          "expressed as a rectangle/vector fill+stroke. Refused, not approximated with a stand-in glyph.",
      };
    }
  }

  const fragmentIndex = buildFragmentIndex(axes);
  const cells = cartesian(axes);
  const knownParts = new Set([entry.rootPart, ...entry.parts]);

  // The host part's OWN resolved bindings, over the SAME axes — what
  // `currentcolor` resolves through (its `color`), never a default/guessed paint.
  const hostEntry =
    hostPart === entry.rootPart
      ? entry
      : { ...entry, rootPart: hostPart, componentRoot: entry.componentRoot ?? entry.rootPart };
  const hostCells = resolveVariantBindings(hostEntry, axes);
  const hostByKey = new Map(
    hostCells.map((c) => [JSON.stringify(Object.entries(c.key).sort()), c]),
  );
  const hostBindFor = (key: Record<string, string>): ResolvedVariantBinding | undefined =>
    hostByKey.get(JSON.stringify(Object.entries(key).sort()))?.bind;

  let radiusRefusal: string | undefined;
  const pseudoPartName = `${hostPart}${pseudo}`;
  const refusedMargins = new Map<string, string>();
  const radiusFallbacks = new Map<string, string>();

  const resultCells: ResolvedVariantCell[] = cells.map((key) => {
    const candidates: CandidateRule[] = [];
    entry.cssRules.forEach((rule, sourceIndex) => {
      const candidate = matchRuleForCell(
        rule,
        hostPart,
        knownParts,
        fragmentIndex,
        key,
        sourceIndex,
        pseudo,
        undefined,
        rootContext(entry),
      );
      if (candidate) candidates.push(candidate);
    });
    candidates.sort((a, b) => a.specificity - b.specificity || a.sourceIndex - b.sourceIndex);

    const localCustomProperties = collectAmbientCustomPropertiesForCell(
      entry,
      knownParts,
      fragmentIndex,
      key,
      candidates,
    );

    const bind: ResolvedVariantBinding = {};
    const geometry: ResolvedGeometry = {};
    let radiusIsFiftyPercent = false;
    let fillIsCurrentColor = false;
    let textIsCurrentColor = false;
    let strokeIsCurrentColor = false;

    for (const decl of cascadeDeclarations(candidates)) {
      const property = decl.property;
      const value = decl.value.trim();
      const lower = value.toLowerCase();

      if (property === "rotate") continue; // Already handled (refused) above.

      if (property === "border-radius") {
        if (lower === "50%") {
          radiusIsFiftyPercent = true;
          pendingRadiusFallbacks.delete(geometry);
          delete geometry.radius;
          delete geometry.radiusPx;
        } else {
          radiusIsFiftyPercent = false;
          applyDeclaration(
            property,
            decl.value,
            bind,
            geometry,
            localCustomProperties,
            pseudoPartName,
          );
        }
        continue;
      }
      if (property === "background-color" || property === "background") {
        if (lower === "currentcolor") {
          fillIsCurrentColor = true;
          delete bind.fill;
        } else {
          fillIsCurrentColor = false;
          applyDeclaration(
            property,
            decl.value,
            bind,
            geometry,
            localCustomProperties,
            pseudoPartName,
          );
        }
        continue;
      }
      if (property === "color") {
        if (lower === "currentcolor") {
          textIsCurrentColor = true;
          delete bind.text;
        } else {
          textIsCurrentColor = false;
          applyDeclaration(
            property,
            decl.value,
            bind,
            geometry,
            localCustomProperties,
            pseudoPartName,
          );
        }
        continue;
      }
      if (property === "border-color" || property === "outline-color") {
        if (lower === "currentcolor") {
          strokeIsCurrentColor = true;
          delete bind.stroke;
        } else {
          strokeIsCurrentColor = false;
          applyDeclaration(
            property,
            decl.value,
            bind,
            geometry,
            localCustomProperties,
            pseudoPartName,
          );
        }
        continue;
      }

      applyDeclaration(property, decl.value, bind, geometry, localCustomProperties, pseudoPartName);
    }

    collectMarginRefusals(geometry, refusedMargins);
    collectRadiusFallbacks(geometry, radiusFallbacks, pseudoPartName);

    if (radiusIsFiftyPercent) {
      const { width, height } = geometry;
      if (
        width?.kind === "literal" &&
        height?.kind === "literal" &&
        width.px === height.px &&
        width.px > 0
      ) {
        geometry.radiusPx = width.px / 2;
      } else {
        radiusRefusal =
          "border-radius: 50% has no Figma equivalent unless the element is a square with a " +
          "known literal size (radius = size / 2 is then exact arithmetic, not a guess) — this " +
          "box isn't a determined literal square, so it's refused rather than approximated " +
          "(same precedent as the non-pseudo radio/switch/slider indicators).";
      }
    }

    if (fillIsCurrentColor || textIsCurrentColor || strokeIsCurrentColor) {
      const hostColor = hostBindFor(key)?.text;
      // Never default to black (or any other color): an unresolved
      // `currentcolor` leaves the field UNBOUND for this cell — the same
      // soft-failure precedent as any other paint the walker can't resolve —
      // rather than inventing a value the host's own CSS never stated.
      if (hostColor) {
        if (fillIsCurrentColor) bind.fill = hostColor;
        if (textIsCurrentColor) bind.text = hostColor;
        if (strokeIsCurrentColor) bind.stroke = hostColor;
      }
    }

    return { key, bind: withSortedKeys(bind), geometry: withSortedKeys(geometry) };
  });

  if (radiusRefusal) return { kind: "refused", reason: radiusRefusal };

  return { kind: "resolved", cells: resultCells, refusedMargins, radiusFallbacks };
}

/** A resolved corner-radius override value — a bindable Figma variable, or a literal px number when the CSS expression (a bare `0`, or a `calc()` of two known tokens) has no variable to bind to. */
export type ComposedChildRadiusValue =
  | { kind: "variable"; name: string }
  | { kind: "literal"; px: number };

export interface ComposedChildOverrideBinding {
  fill?: string;
  stroke?: string;
  effectStyle?: string;
  topLeftRadius?: ComposedChildRadiusValue;
  topRightRadius?: ComposedChildRadiusValue;
  bottomLeftRadius?: ComposedChildRadiusValue;
  bottomRightRadius?: ComposedChildRadiusValue;
  /**
   * The instance's height, as a computed px literal: a parent that sizes its items
   * inside its own padded track (`height: calc(var(--ctl-height) - 2 * var(--control-inset))`)
   * derives it from token values, so it is recomputed per brand on every regeneration —
   * the same reviewed exception as the nested-corner radius. An expression that does
   * not resolve to a number is refused. `insetOf` is the intermediate `fill-inset.ts` turns into
   * `{ kind: "fill" }` (the instance stretches inside its parent's padded track) when the parent
   * is exactly that box; it never reaches a compiled plan.
   */
  height?: { kind: "literal"; px: number; insetOf?: DimensionInset } | { kind: "fill" };
}

/** One PARENT axis cell's resolved overrides, keyed by the composed-child slot's 0-based repeat index. Indices with no matched override are absent, not an empty object. */
export interface ComposedChildOverrideCell {
  key: Record<string, string>;
  positions: Record<number, ComposedChildOverrideBinding>;
}

export interface ResolveComposedChildOverridesResult {
  /** Only cells that resolved at least one instance override for at least one position. */
  cells: ComposedChildOverrideCell[];
  /**
   * Every descendant rule matched against the composed child that named a
   * property outside the bindable set (radius/stroke/fill/effect), or a
   * radius value this resolver couldn't turn into a variable or literal, or a
   * positional pseudo richer than `:first-child`/`:last-child`/a literal or
   * `odd`/`even` `:nth-child()` — keyed so repeats collapse to one entry.
   */
  refusedDescendantOverrides: Map<string, string>;
}

/** `pseudo` (with its leading colon, per `ParsedCompoundSelector.pseudos`) is one of the three positional forms this resolver understands the SHAPE of — whether it can be EVALUATED against a concrete index is `evaluatePositionalPseudo`'s job. */
function isPositionalPseudo(pseudo: string): boolean {
  return pseudo === ":first-child" || pseudo === ":last-child" || pseudo.startsWith(":nth-child(");
}

/**
 * Evaluate a positional pseudo-class against a concrete 0-based composed-
 * child slot index among `total` repeated instances. `undefined` means the
 * pseudo's argument isn't one of the supported literal/`odd`/`even` shapes
 * (e.g. a general `an+b` formula like `:nth-child(2n+1)`) — the caller treats
 * that as a refusal, never a guess.
 */
function evaluatePositionalPseudo(
  pseudo: string,
  index: number,
  total: number,
): boolean | undefined {
  if (pseudo === ":first-child") return index === 0;
  if (pseudo === ":last-child") return index === total - 1;
  const nth = /^:nth-child\(\s*(.+?)\s*\)$/.exec(pseudo);
  if (!nth) return undefined;
  const arg = nth[1];
  const position = index + 1; // CSS's :nth-child is 1-based.
  if (arg === "odd") return position % 2 === 1;
  if (arg === "even") return position % 2 === 0;
  if (/^\d+$/.test(arg)) return position === Number(arg);
  return undefined;
}

interface ComposedChildDescendantCandidate {
  declarations: CssDeclaration[];
  specificity: number;
  sourceIndex: number;
}

function matchDescendantOverrideRule(
  rule: CssRule,
  parentKnownParts: ReadonlySet<string>,
  childDataUi: string,
  fragmentIndex: FragmentIndex,
  key: Record<string, string>,
  index: number,
  total: number,
  sourceIndex: number,
  refusals: Map<string, string>,
): ComposedChildDescendantCandidate | null {
  if (rule.media.some((m) => INTERACTIVE_MEDIA_RE.test(m))) return null;

  let bestMatch: ComposedChildDescendantCandidate | null = null;
  for (const rawSelector of rule.selectors) {
    const parsedCompounds = parseSelectorCompounds(rawSelector);
    // A bare `[data-ui="toggle"]` with no ancestor compound is not the PARENT
    // overriding the child — it's indistinguishable from Toggle styling
    // itself, which isn't this component's CSS to apply.
    if (parsedCompounds.length < 2) continue;

    const target = parsedCompounds.at(-1);
    if (!target || target.type) continue;
    const targetRootAttr = target.attributes.find((attr) => attr.name === "data-ui");
    if (!targetRootAttr || targetRootAttr.value !== childDataUi) continue;

    let specificity = 0;
    let applies = true;

    for (const [compoundIndex, parsed] of parsedCompounds.entries()) {
      const isTarget = compoundIndex === parsedCompounds.length - 1;
      const dataUiAttributes = parsed.attributes.filter((attr) => attr.name === "data-ui");
      if (!isTarget) {
        if (
          dataUiAttributes.some(
            (attribute) => attribute.value === null || !parentKnownParts.has(attribute.value),
          )
        ) {
          applies = false;
          break;
        }
      }

      const compoundFragments = fragmentsForCompound(fragmentIndex, parsed);
      // A `:not(:pseudo)` cannot be verified for a parent's repeat, so the rule is refused.
      if ((parsed.negatedPseudos ?? []).length > 0) {
        applies = false;
        break;
      }
      for (const pseudo of parsed.pseudos) {
        if (isTarget && isPositionalPseudo(pseudo)) {
          const result = evaluatePositionalPseudo(pseudo, index, total);
          if (result === undefined) {
            refusals.set(
              `${pseudo} on [data-ui="${childDataUi}"]`,
              `${pseudo} — only :first-child, :last-child, and a literal-integer/odd/even ` +
                ":nth-child() are supported for composed-child position matching; this form " +
                "can't be mapped to a repeat index, so the rule is refused rather than guessed.",
            );
            applies = false;
            break;
          }
          if (!result) {
            applies = false;
            break;
          }
          specificity++;
          continue;
        }
        if (!pseudoMatchesAxis(pseudo, compoundFragments, key)) {
          applies = false;
          break;
        }
        specificity++;
      }
      if (!applies) break;

      for (const attr of parsed.attributes) {
        specificity++;
        if (attr.name === "data-ui") continue;
        const fragment = attr.value === null ? `[${attr.name}]` : `[${attr.name}="${attr.value}"]`;
        const match = compoundFragments.get(fragment);
        if (!match) {
          if (attr.negated) {
            refusals.set(
              fragment,
              `:not(${fragment}) — "${attr.name}" is not a resolved axis attribute for the ` +
                "parent component; the negation can't be verified, so the rule is refused rather " +
                "than guessed.",
            );
          }
          applies = false;
          break;
        }
        const satisfied = fragmentHolds(match, key);
        if (attr.negated ? satisfied : !satisfied) {
          applies = false;
          break;
        }
      }
      if (!applies) break;
    }
    if (!applies) continue;

    const candidate = { declarations: rule.declarations, specificity, sourceIndex };
    if (!bestMatch || candidate.specificity > bestMatch.specificity) bestMatch = candidate;
  }
  return bestMatch;
}

/** `border-top-left-radius` etc. → the `ComposedChildOverrideBinding` field they set. */
type ComposedChildCornerKey =
  | "topLeftRadius"
  | "topRightRadius"
  | "bottomLeftRadius"
  | "bottomRightRadius";

const RADIUS_CORNER_PROPERTIES: Record<string, ComposedChildCornerKey> = {
  "border-top-left-radius": "topLeftRadius",
  "border-top-right-radius": "topRightRadius",
  "border-bottom-left-radius": "bottomLeftRadius",
  "border-bottom-right-radius": "bottomRightRadius",
};

function resolveComposedChildRadiusValue(
  value: string,
  localCustomProperties: ReadonlyMap<string, string> = new Map(),
): ComposedChildRadiusValue | undefined {
  const trimmed = value.trim();
  // A computed radius, including the nested-corner rule `max(0px, var(--inner-radius, …))`,
  // binds the brand's default radius, the same rule the geometry pipeline applies.
  if (isComputedRadius(trimmed, localCustomProperties)) {
    return { kind: "variable", name: cssVarToFigmaVariableName(COMPUTED_RADIUS_FALLBACK_TOKEN) };
  }
  if (trimmed === "0") return { kind: "literal", px: 0 };
  const literalPx = LITERAL_PX_RE.exec(trimmed);
  if (literalPx) return { kind: "literal", px: Number(literalPx[1]) };
  const refs = varRefs(trimmed);
  // A SINGLE bare `var(--token)` reference and nothing else — no `calc()`,
  // no fallback, no second term. This intentionally does NOT reuse
  // `isBindableGeometryValue`: that helper also accepts a value that
  // resolves through a local custom-property alias, which this function
  // deliberately keeps out of scope (composed-child overrides are a small,
  // reviewed vocabulary, not the full geometry pipeline).
  if (refs.length === 1 && /^var\(\s*--[a-zA-Z0-9-]+\s*\)$/.test(trimmed)) {
    const name = cssVarToFigmaVariableName(refs[0]);
    if (!isProjectToken(name, refs[0])) return undefined;
    return { kind: "variable", name };
  }
  return undefined;
}

/**
 * A composed child's `height` override → px. Only a px literal or a `calc()` linear
 * expression over known token values (the parent's own custom properties followed),
 * evaluated by the same narrow evaluator sizes use. Never negative.
 */
function resolveComposedChildHeightPx(
  value: string,
  localCustomProperties: ReadonlyMap<string, string>,
): number | undefined {
  const trimmed = value.trim().replace(/\s+/g, " ");
  const literalPx = LITERAL_PX_RE.exec(trimmed);
  const px = literalPx
    ? Number(literalPx[1])
    : resolveCalcLinearExpression(trimmed, localCustomProperties);
  // `InstanceNode.resize` rejects anything below 0.01 or non-finite, so such a height is
  // refused here (in both the literal and calc branches) instead of failing at generation.
  return px !== undefined && Number.isFinite(px) && px >= 0.01 ? px : undefined;
}

/** The four corner-radius accumulator keys, in the shape `applyComposedChildOverrideDeclaration` fills — see `CornerAccumulator`. */
const CORNER_KEYS: readonly ComposedChildCornerKey[] = [
  "topLeftRadius",
  "topRightRadius",
  "bottomLeftRadius",
  "bottomRightRadius",
];

/**
 * Per-position corner-radius accumulator, kept SEPARATE from
 * `ComposedChildOverrideBinding` while candidates are still being applied:
 * a corner can be `"refused"` mid-cascade (a higher-specificity rule named
 * it but its value didn't resolve) without that meaning "keep whatever a
 * lower-specificity rule set" — cascade order still matters (a LATER,
 * higher-specificity declaration always wins), but "wins with an unknown
 * value" must clear the corner, not fall back to the earlier one, or the
 * final override would silently show a value the real cascade never
 * actually produces. `resolveComposedChildOverrides` converts this to a
 * `ComposedChildOverrideBinding` once every candidate has been applied,
 * dropping every `"refused"` entry rather than ever emitting one.
 */
type CornerAccumulator = Partial<
  Record<ComposedChildCornerKey, ComposedChildRadiusValue | "refused">
>;

function applyComposedChildOverrideDeclaration(
  property: string,
  value: string,
  binding: ComposedChildOverrideBinding,
  corners: CornerAccumulator,
  selectorLabel: string,
  refusals: Map<string, string>,
  parentCustomProperties: ReadonlyMap<string, string>,
): void {
  if (property === "border-radius") {
    const corner = resolveComposedChildRadiusValue(value, parentCustomProperties);
    if (!corner) {
      refusals.set(
        `${selectorLabel} border-radius`,
        `"${value}" is not a single var() or a literal — a calc()/expression would go stale the ` +
          "moment a token it references changes, so it is refused rather than baked to a number.",
      );
      for (const key of CORNER_KEYS) corners[key] = "refused";
      return;
    }
    for (const key of CORNER_KEYS) corners[key] = corner;
    return;
  }
  const cornerKey = RADIUS_CORNER_PROPERTIES[property];
  if (cornerKey) {
    const corner = resolveComposedChildRadiusValue(value, parentCustomProperties);
    if (!corner) {
      refusals.set(
        `${selectorLabel} ${property}`,
        `"${value}" is not a single var() or a literal — a calc()/expression would go stale the ` +
          "moment a token it references changes, so it is refused rather than baked to a number.",
      );
      corners[cornerKey] = "refused";
      return;
    }
    corners[cornerKey] = corner;
    return;
  }
  if (property === "height" || property === "block-size") {
    const px = resolveComposedChildHeightPx(value, parentCustomProperties);
    if (px === undefined) {
      refusals.set(
        `${selectorLabel} ${property}`,
        `"${value}" is not a px literal or a calc() of known tokens, so the instance height ` +
          "is refused rather than guessed.",
      );
      delete binding.height;
      return;
    }
    const insetOf = parseInsetCalc(value.trim().replace(/\s+/g, " "), parentCustomProperties);
    binding.height = { kind: "literal", px, ...(insetOf ? { insetOf } : {}) };
    return;
  }
  if (property === "background-color" || property === "background") {
    const refs = varRefs(value);
    if (refs.length === 1) {
      binding.fill = cssVarToFigmaVariableName(refs[0]);
      return;
    }
    if (refs.length === 0) return; // A raw literal (e.g. `transparent`) — nothing bindable, not a refusal.
    refusals.set(`${selectorLabel} ${property}`, `"${value}" is not a single var() reference.`);
    return;
  }
  if (property === "border-color") {
    const refs = varRefs(value);
    if (refs.length === 1) {
      binding.stroke = cssVarToFigmaVariableName(refs[0]);
      return;
    }
    if (refs.length === 0) return;
    refusals.set(`${selectorLabel} ${property}`, `"${value}" is not a single var() reference.`);
    return;
  }
  if (property === "border") {
    const colorRef = lastColorVarRef(value);
    if (colorRef) {
      binding.stroke = cssVarToFigmaVariableName(colorRef);
      return;
    }
    return; // No color var() in the shorthand (e.g. `1px solid transparent`) — nothing bindable.
  }
  if (property === "outline" || property === "outline-color") {
    const colorRef = lastColorVarRef(value);
    if (colorRef) {
      binding.stroke = cssVarToFigmaVariableName(colorRef);
      return;
    }
    return;
  }
  if (property === "box-shadow") {
    const result = deriveEffectStyle(value);
    if (result.kind === "effectStyle") {
      binding.effectStyle = result.effectStyle;
      if (result.ring) binding.stroke = result.ring.color;
      return;
    }
    if (result.kind === "ring") {
      binding.stroke = result.ring.color;
      return;
    }
    refusals.set(
      `${selectorLabel} ${property}`,
      `"${value}" did not resolve to an effect or ring.`,
    );
    return;
  }
  // Every property not named above (padding, gap, typography, layout, …) is
  // outside the engine's composed-child override vocabulary — refused and
  // reported under REFUSED DESCENDANT OVERRIDES, never guessed at.
  refusals.set(
    `${selectorLabel} ${property}`,
    `"${property}" is not one of the composed-child override-able properties ` +
      "(per-corner radius, stroke/border, fill, effect).",
  );
}

export function resolveComposedChildOverrides(
  parentEntry: ComponentRegistryEntry,
  childDataUi: string,
  repeatCount: number,
  axes: ComponentRegistryAxis[] = parentEntry.axes,
): ResolveComposedChildOverridesResult {
  const fragmentIndex = buildFragmentIndex(axes);
  const parentKnownParts = new Set([parentEntry.rootPart, ...parentEntry.parts]);
  const refusedDescendantOverrides = new Map<string, string>();

  const cells: ComposedChildOverrideCell[] = [];
  const parentFragmentParts = new Set([parentEntry.rootPart, ...parentEntry.parts]);
  for (const key of cartesian(axes)) {
    const positions: Record<number, ComposedChildOverrideBinding> = {};
    // Custom properties the PARENT publishes for this cell (e.g. the track's
    // `--inner-radius`), which a child's `max(0px, var(--inner-radius, …))` reads.
    const parentOwnCandidates: CandidateRule[] = [];
    parentEntry.cssRules.forEach((rule, sourceIndex) => {
      const candidate = matchRuleForCell(
        rule,
        parentEntry.rootPart,
        parentFragmentParts,
        fragmentIndex,
        key,
        sourceIndex,
        undefined,
        undefined,
        rootContext(parentEntry),
      );
      if (candidate) parentOwnCandidates.push(candidate);
    });
    parentOwnCandidates.sort(
      (a, b) => a.specificity - b.specificity || a.sourceIndex - b.sourceIndex,
    );
    const parentCustomProperties = collectAmbientCustomPropertiesForCell(
      parentEntry,
      parentFragmentParts,
      fragmentIndex,
      key,
      parentOwnCandidates,
    );
    for (let index = 0; index < repeatCount; index++) {
      const candidates: ComposedChildDescendantCandidate[] = [];
      parentEntry.cssRules.forEach((rule, sourceIndex) => {
        const candidate = matchDescendantOverrideRule(
          rule,
          parentKnownParts,
          childDataUi,
          fragmentIndex,
          key,
          index,
          repeatCount,
          sourceIndex,
          refusedDescendantOverrides,
        );
        if (candidate) candidates.push(candidate);
      });
      if (candidates.length === 0) continue;
      candidates.sort((a, b) => a.specificity - b.specificity || a.sourceIndex - b.sourceIndex);
      const binding: ComposedChildOverrideBinding = {};
      const corners: CornerAccumulator = {};
      const selectorLabel = `[data-ui="${childDataUi}"]#${index}`;
      for (const decl of cascadeDeclarations(candidates, { winnersOnly: false })) {
        applyComposedChildOverrideDeclaration(
          decl.property,
          decl.value,
          binding,
          corners,
          selectorLabel,
          refusedDescendantOverrides,
          parentCustomProperties,
        );
      }
      // Only a corner whose LAST (highest-specificity) touching declaration
      // actually resolved becomes part of the final override — a `"refused"`
      // entry is dropped, never fallen back to an earlier lower-specificity
      // value (see `CornerAccumulator`'s docblock).
      for (const key of CORNER_KEYS) {
        const corner = corners[key];
        if (corner && corner !== "refused") binding[key] = corner;
      }
      if (Object.keys(binding).length > 0) positions[index] = withSortedKeys(binding);
    }
    if (Object.keys(positions).length > 0) cells.push({ key, positions });
  }

  return { cells, refusedDescendantOverrides };
}
