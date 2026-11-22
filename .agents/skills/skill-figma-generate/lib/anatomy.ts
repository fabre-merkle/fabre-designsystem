/**
 * The anatomy tree — the PURE decisions about each variant cell's nested parts,
 * native slots and composed children, taken from
 * the compiled V2 artifact and nothing else.
 *
 * This is the skill's mirror of the Figma plugin walker's
 * `buildAnatomyNodePlan`: the same
 * artifact must yield the same tree on both sides, so the parity gate can
 * compare them node for node. It never infers structure — an icon is a slot because
 * the contract declares it, a composed child is an instance because the contract
 * names it — and a decision it cannot make is REPORTED (`unplaced`, refused sizes),
 * never guessed.
 *
 * Standalone by construction: it imports only the skill's own `artifact.ts` /
 * `geometry.ts`, never `@focus/figma-generators`. PURE: no Figma I/O, no
 * `Date`/random. `emit.ts` carries the decisions out through the Plugin API.
 *
 * What a cell's tree carries, per node:
 *
 *   - bindings: fill / text / stroke / effect style, and the geometry tokens
 *     (padding, gap, radius, border, opacity, type) — as Figma variable NAMES
 *   - the box: direction, alignment, literal size, per-axis sizing (bind / fill /
 *     fixed; a `flex-grow` child fills its parent's MAIN axis), aspect ratio
 *   - content: a text slot's example characters, an icon's SVG, a `repeat` count
 *     or `items`
 *   - `slot`: the native slot this node's content lives in, and — when the
 *     contract declares one — the composed child (a component slug + variant key)
 *     whose default instance fills it, with this parent's per-position overrides
 *
 * Declared runtime values are resolved here exactly as the
 * plugin resolves them: a size the CSS reads from a runtime custom property
 * (`var(--active-tab-width)`) becomes a `runtime` size when the contract declares a
 * value that `replaces` it, and a `valueOf` position / length reads the matching
 * documentation example's declared percent. A node exempted from flow
 * (`removeFromFlow`) is placed by the emitter from these resolved values.
 *
 * A position or length along an OVERLAY parent's main axis (`positionAlongMain` /
 * `sizeAlongMain` on a node that is not `removeFromFlow`) is placed by the emitter, as the
 * plugin's `applyDeferredOverlayAlignment` does. Only an overlay child the plugin would not place
 * (a position with no `overlayCrossAlign`) lands in `unplaced`.
 */
import type {
  ArtifactComponent,
  ComposedChildOverrideBinding,
  ContractAnatomyNode,
  GenerationContract,
  ResolvedCell,
  ResolvedGeometry,
} from "./artifact";
import { buildingBlockParts, buildingBlockVariantKey, isInsideBuildingBlock } from "./component-sets";
import { type AxisSizing, axisSizing, keyMatches, type NodeSizing, resolveByAxis } from "./geometry";

export type AnatomyLayout = "horizontal" | "vertical" | "overlay";

/** A slot reference to another component, as DATA — resolved at emit time. */
export interface ComposedChildRef {
  component: string;
  variantKey?: Record<string, string>;
  variantKeyFromAxes?: Record<string, string>;
}

/**
 * The slot a node's content lives in. `stretch` is `align-items: stretch` on a
 * container above the slot; it drives TWO Figma settings (the slot's own
 * `stretchChildOnInsert`, and its cross-axis FILL in its parent) — see `emit.ts`.
 */
export interface AnatomySlotPlan {
  name: string;
  required: boolean;
  stretch: boolean;
  composedChild?: ComposedChildRef;
  /**
   * The child's axis values that follow THIS variant of the parent (`composedChild.variantKeyFromAxes`
   * read against the cell's key). They override the same axes of the child's key, so each parent
   * variant instances the matching child variant.
   */
  composedChildAxisValues?: Record<string, string>;
  /** The default content is the anatomy subtree beneath the frame that names this slot: that frame IS the slot. */
  defaultContent?: boolean;
}

/** Geometry tokens (variable names) and layout enums for one node. */
export interface AnatomyGeometry {
  paddingInline?: string;
  paddingBlock?: string;
  paddingLeft?: string;
  paddingRight?: string;
  paddingTop?: string;
  paddingBottom?: string;
  gap?: string;
  radius?: string;
  borderWidth?: string;
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
  opacity?: string;
  layoutMode?: "HORIZONTAL" | "VERTICAL";
  primaryAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
  counterAxisAlignItems?: "MIN" | "CENTER" | "MAX";
  /** `align-self`: carried by the parent's `counterAxisAlignItems`; a node naming one is refused. */
  alignSelf?: "MIN" | "CENTER" | "MAX";
  /** `align-items: stretch` — the one keyword `counterAxisAlignItems` cannot express. */
  alignItems?: "stretch";
  textAlignHorizontal?: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
  textCase?: "UPPER" | "LOWER" | "ORIGINAL";
  aspectRatio?: number;
  /** A literal corner radius (a `border-radius: 50%` over a known square), applied directly. */
  radiusPx?: number;
  /** Size limits: a variable name where the CSS binds one token, else the px literal it states. */
  minWidth?: string;
  maxWidth?: string;
  minHeight?: string;
  maxHeight?: string;
  minWidthPx?: number;
  maxWidthPx?: number;
  minHeightPx?: number;
  maxHeightPx?: number;
  /** `overflow: hidden | clip`. */
  clipsContent?: true;
  /** `flex-wrap: wrap` on a horizontal row, with the bound gap between wrapped lines. */
  layoutWrap?: "WRAP";
  counterAxisSpacing?: string;
  /** SCALE on each axis whose insets are percentages, beside the percentages that place the child. */
  constraints?: { horizontal?: "SCALE"; vertical?: "SCALE" };
  insetPercent?: { top?: number; right?: number; bottom?: number; left?: number };
}

export type OverlayCrossAlign = "start" | "center" | "end" | "stretch";

/**
 * A position along the parent's main axis, RESOLVED for one cell: a `valueOf` is
 * already a `fraction` (0..1) read off the matching documentation example. `travel` is a declared
 * runtime value that measures travel: a fraction of the parent's FREE space (a scroll thumb).
 * A value with no declaration for the cell is `refused`, never guessed.
 */
export type ResolvedPositionAlongMain =
  | { kind: "start" | "center" | "end" | "stretch" }
  | { kind: "valueOf"; fraction: number }
  | { kind: "travel"; fraction: number }
  | { kind: "refused"; jsProperty: string };

/** A length along the parent's main axis, as a fraction of the parent's main length. */
export type ResolvedSizeAlongMain = { kind: "valueOf"; fraction: number };

export interface AnatomyNodePlan {
  part: string;
  kind: ContractAnatomyNode["kind"];
  /** Set by `frameForPaddedText`: a text part built as a padded frame around its text. */
  paddedText?: true;
  /** The contract's authored direction for this cell (after `layoutByAxis`). */
  layout?: AnatomyLayout;
  /** Cross-axis placement within an `overlay` parent, or of a `removeFromFlow` child. */
  overlayCrossAlign?: OverlayCrossAlign;
  /** exempts this node from its auto-layout parent's flow. */
  removeFromFlow?: boolean;
  /**
   * Set on the focus ring layer: how far its outer edge sits outside the root, in pixels. The ring
   * is taken out of the root's flow and stretched around it once the root has its box.
   */
  focusRingInset?: number;
  /** Set on the focus ring layer of an artifact built without the tokens' pixel values. */
  focusRingUnplaced?: true;
  /** position along the parent's main axis, resolved for this cell. */
  positionAlongMain?: ResolvedPositionAlongMain;
  /** length along the parent's main axis, resolved for this cell. */
  sizeAlongMain?: ResolvedSizeAlongMain;
  fill?: string;
  /** The fill's strength as a fraction, when the CSS mixes it with `transparent`. */
  fillOpacity?: number;
  /** The stroke's strength as a fraction, when the CSS mixes it with `transparent`. */
  strokeOpacity?: number;
  text?: string;
  stroke?: string;
  effectStyle?: string;
  slot?: AnatomySlotPlan;
  /**
   * The component properties bound to this node in this cell, by contract property name:
   * `characters` (text), `visible` (boolean, with the part's default) and `mainComponent`
   * (instance swap, with the icon its default component is made from). A boolean that does not
   * apply in this cell is absent.
   */
  properties?: {
    characters?: string;
    visible?: { name: string; default: boolean };
    mainComponent?: { name: string; iconName: string };
  };
  geometry: AnatomyGeometry;
  sizing: NodeSizing;
  /** Literal dimensions from the contract's `literalGeometry`, not from CSS. */
  width?: number;
  height?: number;
  fontSize?: number;
  lineHeight?: number;
  lineHeightUnit?: "pixels" | "unitless";
  characters?: string;
  iconSvg?: string;
  imageData?: string;
  imageMimeType?: string;
  /** An open stroked arc for an ellipse, in degrees (start defaults to -90). */
  arc?: { start: number; sweep: number };
  repeat?: number;
  items?: AnatomyNodePlan[];
  children: AnatomyNodePlan[];
  /** Instance overrides for this node's composed child, per repeat index. Only set with `slot.composedChild`. */
  composedChildOverridesByIndex?: Record<number, ComposedChildOverrideBinding>;
  /**
   * This node is an instance of a Building Block's hidden set, not a frame of its own: `part` names
   * the block, `key` the block variant (the parent's value for each axis the block shares, the
   * block's default otherwise). Its anatomy lives in the block, so `children` is empty.
   */
  buildingBlock?: {
    part: string;
    key: Record<string, string>;
    /** The item's copy for each text part the block owns that has a value, in slot order. */
    copy?: Array<{ part: string; text: string; property?: string }>;
  };
  /** Placement the skill does not carry out for this node — see the module doc. Reported by the run. */
  unplaced: string[];
}

// ---------- Contract view (the anatomy fields beyond the mirrored few) ----------

interface AnatomyNodeView {
  part: string;
  kind: ContractAnatomyNode["kind"];
  when?: Record<string, string | string[]>;
  unless?: Record<string, string | string[]>;
  slots?: string[];
  layout?: AnatomyLayout;
  layoutByAxis?: { axis: string; values: Partial<Record<string, AnatomyLayout>> };
  overlayCrossAlign?: OverlayCrossAlign;
  overlayCrossAlignByAxis?: { axis: string; values: Partial<Record<string, OverlayCrossAlign>> };
  removeFromFlow?: boolean;
  removeFromFlowByAxis?: { axis: string; values: Partial<Record<string, boolean>> };
  positionAlongMain?: DeclaredAlongMain;
  positionAlongMainByAxis?: { axis: string; values: Partial<Record<string, DeclaredAlongMain>> };
  sizeAlongMain?: DeclaredAlongMain;
  docsLayout?: { gap?: string; justify?: "start" | "center" | "end" | "space-between"; align?: "start" | "center" | "end" | "stretch" };
  iconName?: string;
  iconSvg?: string;
  imageData?: string;
  imageMimeType?: string;
  arc?: { sweep: number; start?: number };
  repeat?: number;
  items?: Array<{ key?: Record<string, string>; slots?: Record<string, string> }>;
  children?: ContractAnatomyNode[];
}

/** A declared along-main anchor: a literal anchor, or a `valueOf` reading a slot or a declared runtime value. */
type DeclaredAlongMain = { kind: "start" | "center" | "end" | "stretch" } | { kind: "valueOf"; slot?: string; runtimeValue?: string };

const view = (node: ContractAnatomyNode): AnatomyNodeView => node as unknown as AnatomyNodeView;

function sameKey(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

type Example = GenerationContract["documentation"]["examples"][number];

/** The documentation example that supplies a value for one of `slots`: the exact cell's, else the closest by shared axis values. */
function exampleForSlots(examples: Example[], key: Record<string, string>, slots: string[]): Example | undefined {
  const exact = examples.find((example) => sameKey(example.key, key));
  if (exact && slots.some((slot) => exact.slots?.[slot] !== undefined)) return exact;
  return examples
    .map((example, index) => ({
      example,
      index,
      score: Object.entries(example.key).filter(([axis, value]) => key[axis] === value).length,
    }))
    .filter(({ example }) => slots.some((slot) => example.slots?.[slot] !== undefined))
    .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.example;
}

// ---------- Declared runtime values ----------

/** A declared percent: the whole string a plain number in [0, 100] (`"40"`), else `undefined`. */
function parseRuntimeValuePercent(raw: string | undefined): number | undefined {
  if (raw === undefined || !/^\s*-?\d+(\.\d+)?\s*$/.test(raw)) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : undefined;
}

/** The declared runtime value for this cell, as a 0..1 fraction, from the best-matching example that declares it. */
function resolveRuntimeValueFraction(contract: GenerationContract, key: Record<string, string>, name: string): number | undefined {
  const examples = contract.documentation.examples;
  const has = (example: Example) => example.runtimeValues?.[name] !== undefined;
  const exact = examples.find((example) => sameKey(example.key, key) && has(example));
  const example =
    exact ??
    examples
      .map((candidate, index) => ({
        candidate,
        index,
        score: Object.entries(candidate.key).filter(([axis, value]) => key[axis] === value).length,
      }))
      .filter(({ candidate }) => has(candidate))
      .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.candidate;
  const percent = parseRuntimeValuePercent(example?.runtimeValues?.[name]);
  return percent === undefined ? undefined : percent / 100;
}

/** A `valueOf`'s fraction: a declared runtime value, else the slot's documented example value. */
function resolveAlongMainFraction(contract: GenerationContract, key: Record<string, string>, declared: DeclaredAlongMain): number | undefined {
  if (declared.kind !== "valueOf") return undefined;
  if (typeof declared.runtimeValue === "string") return resolveRuntimeValueFraction(contract, key, declared.runtimeValue);
  if (typeof declared.slot !== "string") return undefined;
  const raw = exampleForSlots(contract.documentation.examples, key, [declared.slot])?.slots?.[declared.slot];
  if (raw === undefined) return undefined;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed / 100 : undefined;
}

function resolvePositionAlongMain(
  declared: DeclaredAlongMain | undefined,
  contract: GenerationContract,
  key: Record<string, string>,
): ResolvedPositionAlongMain | undefined {
  if (!declared) return undefined;
  if (declared.kind !== "valueOf") return declared;
  const fraction = resolveAlongMainFraction(contract, key, declared);
  const runtimeValue = typeof declared.runtimeValue === "string" ? declared.runtimeValue : undefined;
  if (fraction === undefined) {
    return {
      kind: "refused",
      jsProperty:
        runtimeValue !== undefined
          ? `runtime value "${runtimeValue}" has no declared value for this variant`
          : `slot "${declared.slot}" has no resolved value for this variant`,
    };
  }
  // A slot value centres the child on it (Slider); a runtime value travels through the free space.
  return runtimeValue !== undefined ? { kind: "travel", fraction } : { kind: "valueOf", fraction };
}

function resolveSizeAlongMain(
  declared: DeclaredAlongMain | undefined,
  contract: GenerationContract,
  key: Record<string, string>,
): ResolvedSizeAlongMain | undefined {
  if (!declared) return undefined;
  const fraction = resolveAlongMainFraction(contract, key, declared);
  // A value-driven length has no other honest anchor: unresolved means no length, never a guess.
  return fraction === undefined ? undefined : { kind: "valueOf", fraction };
}

/**
 * A refused `var(--runtime-property)` size becomes a `runtime` size when the contract declares a
 * runtime value that `replaces` that property for this part, and this cell has a value for it.
 * Anything else stays exactly as refused.
 */
function withDeclaredRuntimeSizes(sizing: NodeSizing, part: string, contract: GenerationContract, key: Record<string, string>): NodeSizing {
  const declarations = (contract.runtimeValues ?? []).filter((declaration) => declaration.part === part && declaration.replaces.length > 0);
  if (declarations.length === 0) return sizing;
  const declare = (plan: AxisSizing | undefined): AxisSizing | undefined => {
    if (plan?.mode !== "refused") return plan;
    const property = /^var\(\s*(--[\w-]+)\s*\)$/.exec(plan.value.trim())?.[1];
    const declaration = declarations.find(({ replaces }) => (property ? replaces.includes(property) : false));
    if (!property || !declaration) return plan;
    const fraction = resolveRuntimeValueFraction(contract, key, declaration.name);
    return fraction === undefined ? plan : { mode: "runtime", fraction, property };
  };
  const width = declare(sizing.width);
  const height = declare(sizing.height);
  return { ...(width ? { width } : {}), ...(height ? { height } : {}) };
}

/**
 * The node's sizing with its declarations applied. A `removeFromFlow` child with a declared
 * `sizeAlongMain` drops any `fill`: an absolutely positioned child cannot FILL, and the declared
 * length is the answer (the scroll thumb's `flex: 1` is the live track length).
 */
function declaredSizing(
  sizing: NodeSizing,
  node: AnatomyNodeView,
  removeFromFlow: boolean | undefined,
  contract: GenerationContract,
  key: Record<string, string>,
  /** The node is declared to `stretch` across its parent, which sizes it (as the plugin). */
  stretches = false,
): NodeSizing {
  const declared = withDeclaredRuntimeSizes(sizing, node.part, contract, key);
  if (!removeFromFlow || !(node.sizeAlongMain || stretches)) return declared;
  const width = declared.width?.mode === "fill" ? undefined : declared.width;
  const height = declared.height?.mode === "fill" ? undefined : declared.height;
  return { ...(width ? { width } : {}), ...(height ? { height } : {}) };
}

// ---------- Box ----------

/**
 * A node's sizing. `flex-grow` is "fill my parent's MAIN axis", and only the
 * walk knows the parent: horizontal → width, vertical → height, and an overlay or
 * missing parent is deliberately NOT filled (FILL is legal only under auto-layout).
 * An authored dimension always wins over `flex-grow`.
 */
function nodeSizingInParent(geometry: ResolvedGeometry | undefined, parentLayout: AnatomyLayout | undefined): NodeSizing {
  let width = axisSizing(geometry?.width);
  let height = axisSizing(geometry?.height);
  if (geometry?.growsOnMainAxis) {
    if (parentLayout === "horizontal" && !width) width = { mode: "fill" };
    if (parentLayout === "vertical" && !height) height = { mode: "fill" };
  }
  return { ...(width ? { width } : {}), ...(height ? { height } : {}) };
}

const named = (name: string | undefined): string | undefined => name || undefined;

function geometryOf(geometry: ResolvedGeometry | undefined): AnatomyGeometry {
  const g = geometry as Record<string, unknown> | undefined;
  const str = (field: string) => named(g?.[field] as string | undefined);
  return {
    paddingInline: str("paddingInline"),
    paddingBlock: str("paddingBlock"),
    paddingLeft: str("paddingLeft"),
    paddingRight: str("paddingRight"),
    paddingTop: str("paddingTop"),
    paddingBottom: str("paddingBottom"),
    gap: str("gap"),
    radius: str("radius"),
    borderWidth: str("borderWidth"),
    borderTopWidth: str("borderTopWidth"),
    borderRightWidth: str("borderRightWidth"),
    borderBottomWidth: str("borderBottomWidth"),
    borderLeftWidth: str("borderLeftWidth"),
    fontFamily: str("fontFamily"),
    fontSize: str("fontSize"),
    fontWeight: str("fontWeight"),
    lineHeight: str("lineHeight"),
    letterSpacing: str("letterSpacing"),
    textStyle: str("textStyle"),
    opacity: str("opacity"),
    layoutMode: geometry?.layoutMode,
    primaryAxisAlignItems: geometry?.primaryAxisAlignItems,
    counterAxisAlignItems: geometry?.counterAxisAlignItems,
    alignSelf: g?.alignSelf as AnatomyGeometry["alignSelf"],
    alignItems: g?.alignItems as "stretch" | undefined,
    textAlignHorizontal: g?.textAlignHorizontal as AnatomyGeometry["textAlignHorizontal"],
    textCase: g?.textCase as AnatomyGeometry["textCase"],
    aspectRatio: geometry?.aspectRatio,
    radiusPx: g?.radiusPx as number | undefined,
    minWidth: str("minWidth"),
    maxWidth: str("maxWidth"),
    minHeight: str("minHeight"),
    maxHeight: str("maxHeight"),
    minWidthPx: g?.minWidthPx as number | undefined,
    maxWidthPx: g?.maxWidthPx as number | undefined,
    minHeightPx: g?.minHeightPx as number | undefined,
    maxHeightPx: g?.maxHeightPx as number | undefined,
    clipsContent: g?.clipsContent === true ? true : undefined,
    layoutWrap: g?.layoutWrap === "WRAP" ? "WRAP" : undefined,
    counterAxisSpacing: str("counterAxisSpacing"),
    constraints: g?.constraints as AnatomyGeometry["constraints"],
    insetPercent: g?.insetPercent as AnatomyGeometry["insetPercent"],
  };
}

/** `docsLayout.gap` (`var(--spacing-200)`) → the variable it binds (`spacing/200`). */
function docsLayoutGapVariable(gap: string): string {
  const stripped = gap.replace(/^var\(/, "").replace(/\)$/, "").replace(/^--/, "");
  const idx = stripped.indexOf("-");
  return idx === -1 ? stripped : `${stripped.slice(0, idx)}/${stripped.slice(idx + 1)}`;
}

const DOCS_JUSTIFY = { start: "MIN", center: "CENTER", end: "MAX", "space-between": "SPACE_BETWEEN" } as const;
const DOCS_ALIGN = { start: "MIN", stretch: "MIN", center: "CENTER", end: "MAX" } as const;

/** A synthetic composed-child container has no CSS: its reviewed `docsLayout` supplies gap/alignment, never overriding a real value. */
function withDocsLayout(geometry: AnatomyGeometry, docsLayout: AnatomyNodeView["docsLayout"]): AnatomyGeometry {
  if (!docsLayout) return geometry;
  return {
    ...geometry,
    gap: geometry.gap ?? (docsLayout.gap ? docsLayoutGapVariable(docsLayout.gap) : undefined),
    primaryAxisAlignItems: geometry.primaryAxisAlignItems ?? (docsLayout.justify ? DOCS_JUSTIFY[docsLayout.justify] : undefined),
    counterAxisAlignItems: geometry.counterAxisAlignItems ?? (docsLayout.align ? DOCS_ALIGN[docsLayout.align] : undefined),
  };
}

// ---------- The tree ----------

interface WalkContext {
  component: ArtifactComponent;
  cellIndex: number;
  slotOverrides?: Record<string, string>;
  inheritedText?: string;
  /** `align-items: stretch` on the ROOT marks every slot below it `stretch`. */
  rootAlignStretch: boolean;
  /**
   * For one item of a Building Block's node: the item's `key`, which picks the block's variant (its
   * values win over the parent's, then the block's defaults apply). The item stays in the parent's
   * variant, so a key that names block axes needs no cell of the parent.
   */
  blockItemKey?: Record<string, string>;
}

/** The properties bound to an anatomy node in one variant cell, or undefined when it has none. */
function nodeProperties(
  node: AnatomyNodeView,
  contract: GenerationContract,
  key: Record<string, string>,
): AnatomyNodePlan["properties"] {
  const bound: NonNullable<AnatomyNodePlan["properties"]> = {};
  for (const property of contract.properties ?? []) {
    if (property.part !== node.part) continue;
    // A part a Building Block owns is built in the block, which carries the property.
    if (isInsideBuildingBlock(contract, property.part)) continue;
    if (property.type === "text") bound.characters = property.name;
    else if (property.type === "boolean") {
      if (!(property.unless && keyMatches(key, property.unless))) {
        bound.visible = { name: property.name, default: property.default };
      }
    } else if (node.iconName) {
      bound.mainComponent = { name: property.name, iconName: node.iconName };
    }
  }
  return Object.keys(bound).length > 0 ? bound : undefined;
}

function buildNode(node: ContractAnatomyNode, parentLayout: AnatomyLayout | undefined, walk: WalkContext): AnatomyNodePlan | undefined {
  const { component, cellIndex, slotOverrides, inheritedText, rootAlignStretch } = walk;
  const { contract, resolvedPlan } = component;
  const n = view(node);
  const cell: ResolvedCell | undefined = resolvedPlan.variantMatrix[cellIndex];
  if (!cell || !keyMatches(cell.key, n.when) || (n.unless && keyMatches(cell.key, n.unless))) return undefined;

  const partCell: ResolvedCell | undefined = n.part === contract.rootPart ? cell : resolvedPlan.partBindings?.[n.part]?.[cellIndex];
  const literal = contract.literalGeometry?.find(
    (candidate) => candidate.part === n.part && keyMatches(cell.key, candidate.when as Record<string, string | string[]> | undefined),
  ) as (Record<string, unknown> & { width?: number; height?: number; fontSize?: number; lineHeight?: number; lineHeightUnit?: "pixels" | "unitless" }) | undefined;
  const example = n.slots ? exampleForSlots(contract.documentation.examples, cell.key, n.slots) : undefined;

  // First declared slot with a value wins; a composed-child slot never has literal
  // text (its default is an instance), and an icon's content is embedded at compile
  // time — both are "active" from their own declaration.
  let slotName: string | undefined;
  let characters: string | undefined;
  for (const candidate of n.slots ?? []) {
    const value = slotOverrides?.[candidate] ?? example?.slots?.[candidate];
    if (value !== undefined) {
      slotName = candidate;
      characters = value;
      break;
    }
  }
  const declaredSlot = (name: string | undefined) => contract.slots?.find((declared) => declared.name === name);
  const composedChildSlotName = slotName === undefined ? n.slots?.find((candidate) => declaredSlot(candidate)?.composedChild) : undefined;
  if (composedChildSlotName) slotName = composedChildSlotName;
  // A default-content slot has no literal text: its content is the node's own anatomy subtree.
  const defaultContentSlotName = slotName === undefined ? n.slots?.find((candidate) => declaredSlot(candidate)?.defaultContent) : undefined;
  if (defaultContentSlotName) slotName = defaultContentSlotName;
  const iconSlotName = slotName === undefined && n.kind === "icon" ? n.slots?.[0] : undefined;
  if (iconSlotName) slotName = iconSlotName;
  // A text node that declares slots needs a value for one of them to appear.
  if (n.slots?.length && characters === undefined && n.kind !== "icon" && !composedChildSlotName && !defaultContentSlotName) return undefined;

  const declared = declaredSlot(slotName);
  const slot: AnatomySlotPlan | undefined = slotName
    ? {
        name: slotName,
        required: declared?.required ?? false,
        stretch: rootAlignStretch || declared?.stretch === true,
        composedChild: declared?.composedChild,
        ...composedChildAxisValuesOf(declared?.composedChild, cell.key),
        ...(declared?.defaultContent ? { defaultContent: true } : {}),
      }
    : undefined;
  const composedChildOverridesByIndex =
    slot?.composedChild && slotName
      ? resolvedPlan.composedChildOverrides?.[slotName]?.find((override) => sameKey(override.key, cell.key))?.positions
      : undefined;

  const text = named(partCell?.bind.text) ?? inheritedText ?? named(cell.bind.text);
  const properties = nodeProperties(n, contract, cell.key);
  if (properties?.characters !== undefined && characters === undefined) {
    for (const property of contract.properties ?? []) {
      if (property.type === "text" && property.name === properties.characters) characters = property.default;
    }
  }
  // A node that is a declared Building Block becomes an instance of the block's hidden set: its own
  // anatomy is built there, so none of it is built here.
  const declaredBlock = contract.buildingBlocks?.find((candidate) => candidate.part === n.part);
  const layout = resolveByAxis(n.layoutByAxis, n.layout, cell.key);
  const children = (declaredBlock ? [] : (n.children ?? []))
    .map((child) => buildNode(child, layout, { ...walk, inheritedText: text, blockItemKey: undefined }))
    .filter((child): child is AnatomyNodePlan => Boolean(child));
  const items = n.items
    ?.map((item) => {
      const itemNode = { ...node, items: undefined, repeat: undefined } as ContractAnatomyNode;
      // A Building Block's item is an instance of the block: its key picks the block's variant, in
      // this variant of the parent.
      if (declaredBlock) {
        return buildNode(itemNode, parentLayout, { ...walk, slotOverrides: item.slots, inheritedText, blockItemKey: item.key ?? {} });
      }
      const itemKey = { ...cell.key, ...item.key };
      const itemIndex = resolvedPlan.variantMatrix.findIndex(({ key }) => sameKey(key, itemKey));
      if (itemIndex < 0) return undefined;
      return buildNode(itemNode, parentLayout, { ...walk, cellIndex: itemIndex, slotOverrides: item.slots, inheritedText, blockItemKey: undefined });
    })
    .filter((item): item is AnatomyNodePlan => Boolean(item));

  const resolvedGeometry: ResolvedGeometry | undefined =
    n.part === contract.rootPart ? { ...resolvedPlan.baseGeometry, ...partCell?.geometry } : partCell?.geometry;

  const overlayCrossAlign = resolveByAxis(n.overlayCrossAlignByAxis, n.overlayCrossAlign, cell.key);
  const removeFromFlow = resolveByAxis(n.removeFromFlowByAxis, n.removeFromFlow, cell.key);
  const declaredPositionAlongMain = resolveByAxis(n.positionAlongMainByAxis, n.positionAlongMain, cell.key);
  const positionAlongMain = resolvePositionAlongMain(declaredPositionAlongMain, contract, cell.key);
  const sizeAlongMain = resolveSizeAlongMain(n.sizeAlongMain, contract, cell.key);
  // The emitter places the node from the resolved values above: a removeFromFlow child against an
  // auto-layout parent, an overlay child along the overlay's main axis. The plugin only places an
  // overlay child that has an `overlayCrossAlign`; a position declared on one without it is the
  // plugin's no-op too, so it is reported rather than silently dropped. (A position on an in-flow
  // child of an auto-layout parent is meaningless and ignored by both.)
  const unplaced: string[] = [];
  const unplacedOverlay = parentLayout === "overlay" && !removeFromFlow && !overlayCrossAlign;
  if (unplacedOverlay && positionAlongMain) unplaced.push(`${n.part} positionAlongMain: no overlayCrossAlign, not placed (as the plugin)`);
  if (unplacedOverlay && sizeAlongMain) unplaced.push(`${n.part} sizeAlongMain: no overlayCrossAlign, not placed (as the plugin)`);
  // The ring's inset in this variant: one for every variant, or per value of the axis it follows.
  const isFocusRing = contract.focusRing?.part === n.part;
  const focusRingInset = isFocusRing ? resolveByAxis(contract.focusRing?.insetPxByAxis, contract.focusRing?.insetPx, cell.key) : undefined;

  return frameForPaddedText({
    part: n.part,
    kind: n.kind,
    layout,
    ...(overlayCrossAlign ? { overlayCrossAlign } : {}),
    ...(removeFromFlow !== undefined ? { removeFromFlow } : {}),
    ...(isFocusRing ? (focusRingInset !== undefined ? { focusRingInset } : { focusRingUnplaced: true as const }) : {}),
    ...(positionAlongMain ? { positionAlongMain } : {}),
    ...(sizeAlongMain ? { sizeAlongMain } : {}),
    fill: named(partCell?.bind.fill),
    ...(partCell?.bind.fillOpacity !== undefined ? { fillOpacity: partCell.bind.fillOpacity } : {}),
    text,
    stroke: named(partCell?.bind.stroke) ?? (partCell?.bind.strokeFromText ? text : undefined),
    ...(partCell?.bind.strokeOpacity !== undefined ? { strokeOpacity: partCell.bind.strokeOpacity } : {}),
    effectStyle: partCell?.bind.effectStyle,
    slot,
    ...(properties ? { properties } : {}),
    geometry: withDocsLayout(geometryOf(resolvedGeometry), n.docsLayout),
    sizing: declaredSizing(
      nodeSizingInParent(resolvedGeometry, parentLayout),
      n,
      removeFromFlow,
      contract,
      cell.key,
      declaredPositionAlongMain?.kind === "stretch" || overlayCrossAlign === "stretch",
    ),
    width: literal?.width,
    height: literal?.height,
    fontSize: literal?.fontSize,
    lineHeight: literal?.lineHeight,
    lineHeightUnit: literal?.lineHeightUnit,
    characters,
    iconSvg: n.kind === "icon" ? (n.iconSvg ?? cell.iconSvg) : undefined,
    imageData: n.kind === "image" ? n.imageData : undefined,
    imageMimeType: n.kind === "image" ? n.imageMimeType : undefined,
    ...(n.kind === "ellipse" && n.arc ? { arc: { start: n.arc.start ?? -90, sweep: n.arc.sweep } } : {}),
    repeat: n.repeat,
    items,
    children,
    composedChildOverridesByIndex,
    ...(declaredBlock
      ? {
          buildingBlock: {
            part: declaredBlock.part,
            key: buildingBlockVariantKey(declaredBlock, { ...cell.key, ...walk.blockItemKey }),
            ...blockCopy(contract, declaredBlock.part, cell.key, slotOverrides),
          },
        }
      : {}),
    unplaced,
  });
}

/**
 * The copy a block instance shows: one entry per text part the block owns, in slot order, with the
 * value the item (or the matching example) gives the part's first slot that has one, as a node's
 * own text is chosen, and the block's text property for the part when it has one.
 */
function blockCopy(
  contract: GenerationContract,
  part: string,
  key: Record<string, string>,
  slotOverrides?: Record<string, string>,
): { copy?: Array<{ part: string; text: string; property?: string }> } {
  const owned = buildingBlockParts(contract).get(part);
  const copy: Array<{ part: string; text: string; property?: string }> = [];
  for (const slot of contract.slots ?? []) {
    if (!owned?.has(slot.part) || slot.composedChild || copy.some((entry) => entry.part === slot.part)) continue;
    const node = findAnatomyNode(contract.anatomy, slot.part);
    if (node?.kind !== "text") continue;
    // The part's own slots in its declared order, the first with a value winning.
    const slots = (node.slots ?? [slot.name]).filter((name) => contract.slots?.some((declared) => declared.name === name && !declared.composedChild));
    const example = exampleForSlots(contract.documentation.examples, key, slots);
    const text = slots.map((name) => slotOverrides?.[name] ?? example?.slots?.[name]).find((value) => value !== undefined);
    if (text === undefined) continue;
    const property = (contract.properties ?? []).find((candidate) => candidate.type === "text" && candidate.part === slot.part)?.name;
    copy.push({ part: slot.part, text, ...(property ? { property } : {}) });
  }
  return copy.length > 0 ? { copy } : {};
}

function findAnatomyNode(node: ContractAnatomyNode | undefined, part: string): ContractAnatomyNode | undefined {
  if (!node) return undefined;
  if (node.part === part) return node;
  for (const child of node.children ?? []) {
    const found = findAnatomyNode(child, part);
    if (found) return found;
  }
  return undefined;
}

/**
 * The key a composed-child request is known by: its slot, and the child's axis values a parent
 * variant selects, when the child follows it.
 */
export function composedChildRequestKey(slot: string, axisValues?: Record<string, string>): string {
  const values = Object.entries(axisValues ?? {})
    .map(([axis, value]) => `${axis}=${value}`)
    .sort();
  return values.length > 0 ? `${slot} (${values.join(", ")})` : slot;
}

/**
 * The child's axis values a parent variant selects (`variantKeyFromAxes` read against the cell's
 * key), as the slot plan's `composedChildAxisValues`; empty when the reference follows nothing.
 */
export function composedChildAxisValuesOf(
  ref: ComposedChildRef | undefined,
  cellKey: Readonly<Record<string, string>>,
): { composedChildAxisValues?: Record<string, string> } {
  const entries = Object.entries(ref?.variantKeyFromAxes ?? {}).flatMap(([childAxis, parentAxis]) =>
    cellKey[parentAxis] === undefined ? [] : [[childAxis, cellKey[parentAxis]] as const],
  );
  return entries.length > 0 ? { composedChildAxisValues: Object.fromEntries(entries) } : {};
}

const PADDING_FIELDS = ["paddingInline", "paddingBlock", "paddingLeft", "paddingRight", "paddingTop", "paddingBottom"] as const;

/** Where a hugging text sits in its padded frame, from the CSS `text-align` it carries. */
const TEXT_ALIGN_TO_PRIMARY: Record<string, "MIN" | "CENTER" | "MAX"> = { LEFT: "MIN", CENTER: "CENTER", RIGHT: "MAX", JUSTIFIED: "MIN" };

/**
 * PURE, as the plugin's. A text part whose CSS pads it as the frame its CSS box is: a Figma text
 * node has no padding, so the padding binds on a horizontal frame named for the part and the copy
 * is that frame's text content (`appendAnatomyContent`). The frame keeps the part's box; the text
 * keeps its style, case, colour, slot and text property. Any other plan is returned unchanged.
 */
export function frameForPaddedText(plan: AnatomyNodePlan): AnatomyNodePlan {
  if (plan.kind !== "text" || plan.items?.length || plan.buildingBlock) return plan;
  if (!PADDING_FIELDS.some((field) => plan.geometry[field] !== undefined)) return plan;
  const align = plan.geometry.textAlignHorizontal;
  return {
    ...plan,
    kind: "frame",
    layout: "horizontal",
    paddedText: true,
    // A text part paints its colour from `text`, falling back to `fill`; the frame keeps a fill
    // only when it is a background behind a text colour of its own.
    text: plan.text ?? plan.fill,
    fill: plan.text ? plan.fill : undefined,
    geometry: {
      ...plan.geometry,
      ...(align && plan.geometry.primaryAxisAlignItems === undefined ? { primaryAxisAlignItems: TEXT_ALIGN_TO_PRIMARY[align] } : {}),
    },
    children: [],
  };
}

/**
 * PURE. One variant cell's anatomy tree, or `undefined` when the contract declares
 * no anatomy or the root does not apply to this cell (`when`/`unless`) — the cell
 * then falls back to the generic label, as the plugin does.
 */
export function cellAnatomyPlan(component: ArtifactComponent, cellIndex: number): AnatomyNodePlan | undefined {
  const root = component.contract.anatomy;
  if (!root) return undefined;
  const cell = component.resolvedPlan.variantMatrix[cellIndex];
  if (!cell) return undefined;
  const geometry = { ...component.resolvedPlan.baseGeometry, ...cell.geometry };
  const alignStretch = (geometry as { alignItems?: unknown }).alignItems === "stretch";
  return buildNode(root, undefined, { component, cellIndex, rootAlignStretch: alignStretch });
}

/** PURE. One entry per variant cell, parallel to `variantMatrix`. */
export function componentAnatomyPlans(component: ArtifactComponent): Array<AnatomyNodePlan | undefined> {
  return component.resolvedPlan.variantMatrix.map((_, index) => cellAnatomyPlan(component, index));
}

/** Depth-first, parent before children (`items` before `children`) — the order the emitter creates nodes. */
export function walkAnatomy(root: AnatomyNodePlan, visit: (node: AnatomyNodePlan) => void): void {
  visit(root);
  for (const item of root.items ?? []) walkAnatomy(item, visit);
  for (const child of root.children) walkAnatomy(child, visit);
}

/** Every variable name a cell tree binds — merged into the preflight's token coverage check. */
export function tokensInAnatomy(plans: ReadonlyArray<AnatomyNodePlan | undefined>): string[] {
  const out: string[] = [];
  const add = (name: string | undefined) => {
    if (name && !out.includes(name)) out.push(name);
  };
  const addOverride = (override: ComposedChildOverrideBinding | undefined) => {
    if (!override) return;
    add(override.fill);
    add(override.stroke);
    for (const corner of [override.topLeftRadius, override.topRightRadius, override.bottomLeftRadius, override.bottomRightRadius]) {
      if (corner?.kind === "variable") add(corner.name);
    }
  };
  for (const plan of plans) {
    if (!plan) continue;
    walkAnatomy(plan, (node) => {
      for (const name of [node.fill, node.text, node.stroke]) add(name);
      const g = node.geometry;
      for (const name of [g.paddingInline, g.paddingBlock, g.paddingLeft, g.paddingRight, g.paddingTop, g.paddingBottom, g.gap, g.radius, g.borderWidth, g.borderTopWidth, g.borderRightWidth, g.borderBottomWidth, g.borderLeftWidth, g.opacity]) add(name);
      for (const axis of [node.sizing.width, node.sizing.height]) if (axis?.mode === "bind") add(axis.variable);
      for (const override of Object.values(node.composedChildOverridesByIndex ?? {})) addOverride(override);
    });
  }
  return out;
}

// ---------- Composition ----------

/** The child's variant key for a composed-child reference: the explicit key, else the child's own axis defaults. */
export function composedChildKey(child: ArtifactComponent, ref: ComposedChildRef, axisValues?: Record<string, string>): Record<string, string> {
  // The axes the parent's variant selects (`variantKeyFromAxes`) replace the same axes of the key.
  return { ...(ref.variantKey ?? Object.fromEntries(child.contract.axes.map((axis) => [axis.prop, axis.default]))), ...axisValues };
}

/**
 * The child's resolved-cell LABEL for a reference — the join key to the child's
 * already-generated `ComponentNode`. `undefined` when no cell matches: that child
 * is refused and reported, never substituted.
 */
export function composedChildVariantLabel(child: ArtifactComponent, ref: ComposedChildRef, axisValues?: Record<string, string>): string | undefined {
  const key = composedChildKey(child, ref, axisValues);
  const keys = Object.keys(key);
  return child.resolvedPlan.variantMatrix.find((cell) => Object.keys(cell.key).length === keys.length && keys.every((axis) => cell.key[axis] === key[axis]))?.label;
}

/**
 * The generation order for `selectedSlugs` plus every component their composed-child
 * slots require, children before consumers (a child's component set must exist
 * before its consumer is generated). `forced` are the slugs pulled in only as
 * dependencies — reported, not silently included. Ties break by sorted slug.
 * Throws on a reference to a component the artifact lacks, or a cycle.
 */
export function generationOrder(
  components: readonly ArtifactComponent[],
  selectedSlugs: readonly string[],
): { order: string[]; forced: string[] } {
  const bySlug = new Map(components.map((component) => [component.contract.slug, component]));
  const childrenOf = (slug: string): string[] => [
    ...new Set((bySlug.get(slug)?.contract.slots ?? []).flatMap((slot) => (slot.composedChild ? [slot.composedChild.component] : []))),
  ];
  for (const component of components) {
    for (const child of childrenOf(component.contract.slug)) {
      if (!bySlug.has(child)) {
        throw new Error(`"${component.contract.slug}" composes unknown component "${child}"; the artifact has no such component.`);
      }
    }
  }
  const closure = new Set<string>();
  const include = (slug: string) => {
    if (closure.has(slug) || !bySlug.has(slug)) return;
    closure.add(slug);
    for (const child of childrenOf(slug)) include(child);
  };
  for (const slug of [...selectedSlugs].sort((a, b) => a.localeCompare(b))) include(slug);

  const remaining = new Map<string, number>([...closure].map((slug) => [slug, childrenOf(slug).length]));
  const dependents = new Map<string, string[]>();
  for (const slug of closure) for (const child of childrenOf(slug)) dependents.set(child, [...(dependents.get(child) ?? []), slug]);
  const queue = [...closure].filter((slug) => remaining.get(slug) === 0).sort((a, b) => a.localeCompare(b));
  const order: string[] = [];
  while (queue.length > 0) {
    const slug = queue.shift() as string;
    order.push(slug);
    const ready: string[] = [];
    for (const consumer of dependents.get(slug) ?? []) {
      const left = (remaining.get(consumer) ?? 0) - 1;
      remaining.set(consumer, left);
      if (left === 0) ready.push(consumer);
    }
    queue.push(...ready.sort((a, b) => a.localeCompare(b)));
  }
  if (order.length !== closure.size) throw new Error("The composed-child graph has a cycle; fix the contracts and re-run `bun run figma:contract`.");
  const selected = new Set(selectedSlugs);
  return { order, forced: order.filter((slug) => !selected.has(slug)) };
}
