import type { ComponentRegistryAxis } from "../registry";
import type { FigmaLayoutManifestEntry, ResolvedComponentPlan } from "../resolved-plan";

export const GENERATION_CONTRACT_SOURCE_SCHEMA_VERSION = 1 as const;
export const GENERATION_CONTRACT_ARTIFACT_SCHEMA_VERSION = 2 as const;

/** The 13 visual roles used to render documentation chrome. */
export const DOCUMENTATION_THEME_CHROME_ROLES = [
  "page",
  "section",
  "text",
  "textSubtle",
  "divider",
  "radius",
  "rowGap",
  "contentGap",
  "sectionGap",
  "pageGutter",
  "titleStyle",
  "bodyStyle",
  "captionStyle",
] as const;

export const DOCUMENTATION_THEME_ROLES = [
  "defaultMode",
  ...DOCUMENTATION_THEME_CHROME_ROLES,
] as const;

export type DocumentationThemeRole = (typeof DOCUMENTATION_THEME_ROLES)[number];

/** Documentation roles resolved as a mode tag or local Text Styles, never Variables. */
export const DOCUMENTATION_THEME_NON_VARIABLE_ROLES: ReadonlySet<DocumentationThemeRole> = new Set([
  "defaultMode",
  "titleStyle",
  "bodyStyle",
  "captionStyle",
]);

export interface DocumentationTheme {
  defaultMode: string;
  page: string;
  section: string;
  text: string;
  textSubtle: string;
  divider: string;
  radius: string;
  rowGap: string;
  contentGap: string;
  sectionGap: string;
  pageGutter: string;
  titleStyle: string;
  bodyStyle: string;
  captionStyle: string;
}

export interface DocumentationPage {
  /** Origin + path prefix of the component docs; the page links to `${docsBaseUrl}/${slug}`. */
  docsBaseUrl?: string;
  /** Wordmark shown in the page header. */
  brandName?: string;
}

export interface LiteralGeometry {
  part: string;
  when?: Record<string, string>;
  width?: number;
  height?: number;
  fontSize?: number;
  lineHeight?: number;
  lineHeightUnit?: "pixels" | "unitless";
}

export interface ComposedChildRef {
  /** The other component's contract `slug` (e.g. `"toggle"`, `"input"`). */
  component: string;
  /** Explicit override of the child's own axis defaults. Omit to use them as-is. */
  variantKey?: Record<string, string>;
  /**
   * Axes of the child that follow the parent's own variant: `{ variant: "variant" }` instances the
   * child in the variant the parent's cell has for `variant`, in every cell. Each entry is
   * `childAxis: parentAxis`, and every value of the parent axis must be a value of the child axis.
   * It overrides the same axis of `variantKey` (or of the child's defaults), so the others stay as
   * they are.
   */
  variantKeyFromAxes?: Record<string, string>;
}

export interface GenerationContractSlot {
  /** Stable name used by documentation examples to provide representative content. */
  name: string;
  /** The declared part that renders this content. */
  part: string;
  required?: boolean;
  /**
   * The name of the component prop that receives this slot's content in code, when it differs
   * from `name` (a `label` slot is the component's `children`). Code Connect renders the slot
   * there. Omit it when the prop has the slot's own name. Declared, never inferred.
   */
  codeProp?: string;
  composedChild?: ComposedChildRef;
  /**
   * The region accepts arbitrary children, and this slot's default content is the anatomy subtree
   * beneath the frame that names it (the documentation example's own composition). The frame IS
   * the slot: a native slot where the Figma build has them, a plain frame holding the same
   * children where it does not. Requires the slot's part to be a frame node with children.
   */
  defaultContent?: "anatomy";
  /**
   * The slot's frame fills its parent's cross axis, as the CSS content region does (a block child
   * of a column). Drives the slot frame's fill sizing and `stretchChildOnInsert`.
   */
  stretch?: boolean;
}

export type GenerationContractNodeKind =
  | "frame"
  | "text"
  | "icon"
  | "rectangle"
  | "ellipse"
  | "image";

export const SUPPORTED_IMAGE_ASSET_MIME_TYPES = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
} as const;

export type SupportedImageAssetExtension = keyof typeof SUPPORTED_IMAGE_ASSET_MIME_TYPES;

export const MAX_EMBEDDED_ASSET_BYTES = 300 * 1024;
export type GenerationContractLayout = "horizontal" | "vertical" | "overlay";
export type GenerationContractBindingRole =
  | "fill"
  | "text"
  | "stroke"
  | "textStyle"
  | "effectStyle";

export type CrossAlign = "start" | "center" | "end" | "stretch";

export type PositionAlongMain =
  | { kind: CrossAlign }
  | ValueOf
  | { kind: "refused"; jsProperty: string };

export type ValueOf = { kind: "valueOf"; slot: string } | { kind: "valueOf"; runtimeValue: string };

export interface GenerationContractRuntimeValue {
  /** Stable name used by `examples[].runtimeValues` and `valueOf.runtimeValue`. */
  name: string;
  /** The declared part this value places or sizes. */
  part: string;
  /**
   * `length`: percent of the parent's length (a size). `travel`: percent of
   * the parent's free space along its main axis (an offset that keeps the
   * part inside its parent at every value).
   */
  measures: "length" | "travel";
  /** Runtime CSS custom properties this declaration stands in for (may be empty). */
  replaces: string[];
  /** Why the value is runtime-measured and what the representative values show. */
  reason: string;
}

export type DocsLayoutJustify = "start" | "center" | "end" | "space-between";
/** `docsLayout`'s `align` maps to Figma `counterAxisAlignItems` (`"stretch"` has no Figma member — see the field's own doc comment). */
export type DocsLayoutAlign = "start" | "center" | "end" | "stretch";

export interface DocsLayoutDeclaration {
  /**
   * A literal `var(--token-name)` reference, and ONLY that shape — never a
   * raw px/rem value, never a `calc()`, never a fallback. Bound as a real
   * Figma variable (`itemSpacing`) at generation time, exactly like a
   * CSS-derived gap, through the same `bindNodeField`/unresolved-reporting
   * pipeline every other gap uses. A literal gap in the docs markup (e.g.
   * checkbox-group/radio-group's inline `<label>` at `gap: "0.5rem"`) is NOT
   * eligible — it stays hugged and reported, per the rule's own "reject a
   * literal px gap" clause.
   */
  gap?: string;
  /** Figma `primaryAxisAlignItems`. */
  justify?: DocsLayoutJustify;
  /** Figma `counterAxisAlignItems`. */
  align?: DocsLayoutAlign;
  /**
   * `"<repo-relative docs file path>:<line>"` naming exactly where this was
   * authored — reviewed, not just documented: `compileGenerationContract`
   * verifies (via an injected checker, since this module has no filesystem
   * access in the plugin sandbox) that the named file actually exists.
   */
  source: string;
}

/** `docsLayout.gap` shape: a bare `var(--token-name)` reference, nothing else. */
export const DOCS_LAYOUT_GAP_TOKEN_RE = /^var\(--[a-zA-Z0-9-]+\)$/;
export const DOCS_LAYOUT_JUSTIFY_VALUES: ReadonlySet<string> = new Set([
  "start",
  "center",
  "end",
  "space-between",
]);
export const DOCS_LAYOUT_ALIGN_VALUES: ReadonlySet<string> = new Set([
  "start",
  "center",
  "end",
  "stretch",
]);

/** `docsLayout.gap`'s `var(--x)` → the Figma variable name it's bound as (e.g. `--spacing-200` → `spacing/200`). */
export function docsLayoutGapVariableName(gap: string): string {
  const stripped = gap
    .replace(/^var\(/, "")
    .replace(/\)$/, "")
    .replace(/^--/, "");
  const idx = stripped.indexOf("-");
  return idx === -1 ? stripped : `${stripped.slice(0, idx)}/${stripped.slice(idx + 1)}`;
}

/** Figma `primaryAxisAlignItems` for a `docsLayout.justify` value. */
export function docsLayoutPrimaryAxisAlignItems(
  justify: DocsLayoutJustify,
): "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN" {
  switch (justify) {
    case "start":
      return "MIN";
    case "center":
      return "CENTER";
    case "end":
      return "MAX";
    case "space-between":
      return "SPACE_BETWEEN";
  }
}

/** Figma `counterAxisAlignItems` for a `docsLayout.align` value (`"stretch"` has no Figma member — see `DocsLayoutAlign`'s own doc comment). */
export function docsLayoutCounterAxisAlignItems(align: DocsLayoutAlign): "MIN" | "CENTER" | "MAX" {
  switch (align) {
    case "start":
    case "stretch":
      return "MIN";
    case "center":
      return "CENTER";
    case "end":
      return "MAX";
  }
}

/**
 * Splits a `docsLayout.source` (`"<path>:<line>"`) into its file path and line
 * number, or returns `undefined` if the shape itself is wrong (no colon, no
 * trailing digits, or an empty path) — used by both the compiler (author-time,
 * plus a real file-existence check) and the artifact validator (load-time,
 * shape only).
 */
export function parseDocsLayoutSource(source: string): { path: string; line: number } | undefined {
  const match = /^(.+):(\d+)$/.exec(source.trim());
  if (!match) return undefined;
  const [, path, line] = match;
  if (!path.trim()) return undefined;
  return { path, line: Number(line) };
}

export interface GenerationContractAnatomyNode {
  part: string;
  /** Contract-only composition role with no required `data-ui` source part. */
  synthetic?: boolean;
  docsLayout?: DocsLayoutDeclaration;
  kind: GenerationContractNodeKind;
  layout?: GenerationContractLayout;
  /** Resolve layout from a visual axis when horizontal/vertical anatomy differs. */
  layoutByAxis?: {
    axis: string;
    values: Partial<Record<string, GenerationContractLayout>>;
  };
  overlayCrossAlign?: CrossAlign;
  /**
   * Resolve `overlayCrossAlign` from a visual axis — see
   * `positionAlongMainByAxis`'s doc comment for why this exists (Tabs'
   * indicator: the cross axis STRETCHES in vertical orientation instead of
   * anchoring to an edge, the mirror image of what the main axis does).
   */
  overlayCrossAlignByAxis?: {
    axis: string;
    values: Partial<Record<string, CrossAlign>>;
  };
  removeFromFlow?: boolean;
  removeFromFlowByAxis?: {
    axis: string;
    values: Partial<Record<string, boolean>>;
  };
  positionAlongMain?: PositionAlongMain;
  /**
   * Resolve `positionAlongMain` from a visual axis, mirroring `layoutByAxis`
   * — needed when a `removeFromFlow` child's anchor genuinely differs by
   * orientation rather than being auto-detected the way an OVERLAY child's
   * main axis is (`overlayMainAxisFromSizing`, read off live sizing). Tabs'
   * indicator is the motivating case: `tabs-tab` is always `layout:
   * "horizontal"` (it never rotates — orientation only changes which edge
   * the CSS-drawn bar sits on), so the walker's `layoutMode`-derived main
   * axis stays horizontal in BOTH orientations, but `tabs.css` wants the
   * indicator to STRETCH along that axis when horizontal and sit at its
   * START when vertical (where the cross axis stretches instead — see
   * `overlayCrossAlignByAxis`). Declaring two anatomy nodes for one `part`
   * is not legal (a part is materialized exactly once); this is the
   * `layoutByAxis`-shaped alternative. `reason` is still required exactly as
   * for the plain field.
   */
  positionAlongMainByAxis?: {
    axis: string;
    values: Partial<Record<string, PositionAlongMain>>;
  };
  sizeAlongMain?: ValueOf;
  reason?: string;
  /** Slots whose first populated example value is rendered within this node. */
  slots?: string[];
  /**
   * Render the node only when every axis/value pair matches the variant cell.
   * A value may be a single string (exact match) or a string array (matches
   * ANY of them — e.g. `{ variant: ["solid-text", "content"] }` for a pseudo
   * part that appears on more than one, but not all, axis values). Multiple
   * axes in the same record are still AND-ed together; only the values
   * within one axis are OR-ed.
   */
  when?: Record<string, string | string[]>;
  /** Omit the node when every axis/value pair matches the variant cell (same array-as-OR shape as `when`). */
  unless?: Record<string, string | string[]>;
  /** Repeat a declared part without duplicating its role in the contract tree. */
  repeat?: number;
  /** Materialize the same compound subtree with per-item state/content overrides. */
  items?: Array<{
    key?: Record<string, string>;
    slots?: Record<string, string>;
  }>;
  /** CSS-derived bindings that must resolve for every materialized variant. */
  requiredBindings?: GenerationContractBindingRole[];
  /** Build-time icon lookup; the compiler embeds `iconSvg` into the portable artifact. */
  iconName?: string;
  iconSvg?: string;
  /**
   * Build-time local image asset lookup for a `kind: "image"` node — a path relative to the
   * component's own directory (the same directory as `componentPath`), e.g.
   * `"avatar-placeholder.svg"`. The compiler validates, reads, and base64-encodes the file into
   * `imageData`/`imageMimeType` below; author contracts declare only this field.
   */
  imageAssetPath?: string;
  /** Embedded base64 image payload consumed by the sandbox. Source contracts should omit this field. */
  imageData?: string;
  /** MIME type inferred from `imageAssetPath`'s extension. Source contracts should omit this field. */
  imageMimeType?: string;
  /**
   * For a `kind: "ellipse"` node: draw an open arc instead of a full ring. CSS expresses a
   * partial stroke as `stroke-dasharray` on a circle, which has no Figma equivalent, so the
   * sweep is declared here and emitted as the ellipse's `arcData` (a stroke-only arc: inner
   * radius 1, no fill).
   */
  arc?: GenerationContractArc;
  children?: GenerationContractAnatomyNode[];
}

/** An ellipse's arc: `sweep` degrees clockwise from `start` (default `-90`, 12 o'clock). */
export interface GenerationContractArc {
  /** Angular extent in degrees, greater than 0 and less than 360. */
  sweep: number;
  /** Start angle in degrees, clockwise from 3 o'clock (CSS-like screen angle). Default `-90`. */
  start?: number;
}

export interface GenerationContractDocumentationExample {
  label: string;
  key: Record<string, string>;
  /** Representative content keyed by declared slot name. */
  slots?: Record<string, string>;
  runtimeValues?: Record<string, string>;
}

/** Where a part-component contract reads its source from. */
export interface GenerationContractSource {
  /** The component whose folder holds the `.tsx` and `.css`, e.g. `"field"`. */
  slug: string;
}

/**
 * A Figma component property the contract declares beyond its variant axes and slots. Properties
 * carry what is not a visual difference: text a designer edits, a part that shows or hides, and a
 * swappable icon. A visual difference stays a variant axis; arbitrary children stay a slot.
 *
 * Each property is bound to one declared `part`. Names share one namespace with axis `prop`s and
 * slot `name`s, so none may repeat.
 */
export type GenerationContractProperty =
  | GenerationContractTextProperty
  | GenerationContractBooleanProperty
  | GenerationContractInstanceSwapProperty;

/** A TEXT property: the characters of a text part. */
export interface GenerationContractTextProperty {
  type: "text";
  /** The Figma property name, also the name Code Connect reads. */
  name: string;
  /** The declared text part whose characters the property sets. */
  part: string;
  /** The text every variant shows until an instance overrides it. */
  default: string;
  /** The component prop that receives the text in code (`children` for a label). */
  codeProp?: string;
}

/** A BOOLEAN property: shows or hides a part. */
export interface GenerationContractBooleanProperty {
  type: "boolean";
  name: string;
  /** The declared part whose visibility the property sets. */
  part: string;
  /** Whether the part is shown by default. */
  default: boolean;
  /** Variant cells (axis to value) where the part is always shown and the property does not apply. */
  unless?: Record<string, string | string[]>;
  /** The boolean component prop that carries the value in code. Exclusive with `contentPresence`. */
  codeProp?: string;
  /**
   * In code the part's content is present or absent: Code Connect renders the part's text or
   * instance-swap content only while the property is on. Exclusive with `codeProp`.
   */
  contentPresence?: boolean;
}

/** An INSTANCE_SWAP property: a swappable icon whose default is the part's anatomy `iconName`. */
export interface GenerationContractInstanceSwapProperty {
  type: "instanceSwap";
  name: string;
  /** The declared icon part. Its anatomy node's `iconName` is the default icon component. */
  part: string;
  /** The component prop that receives the icon in code (`children` or an icon prop). */
  codeProp?: string;
}

/**
 * Splits a contract's output into several component sets, one per value of a primary axis, or one
 * per combination of values of several axes. Every
 * set is generated from the one contract, so shared anatomy and bindings stay in step. The split
 * axis is no longer a variant property inside each set: each set is named for its value, and Code
 * Connect maps each set to the same component with that value as a fixed prop.
 */
export interface GenerationContractSplit {
  /**
   * The contract axis whose values each become one component set, or a list of axes whose value
   * combinations each become one (the cartesian product, first axis outermost).
   */
  axis: string | string[];
}

/**
 * A shape of the component: a group of variants that differ in kind, not just in value, and so is
 * generated as sets of its own. Button's icon-only shape is square, has no label and uses its own
 * sizes, so it is not a `content` value in the text button's sets.
 *
 * The shapes together say which combinations of axis values exist: a variant belongs to the first
 * shape whose `values` list its value on every axis the shape names, and a variant in no shape is
 * not generated (an `icon-xs` button with a label). An axis a shape lists with one value is fixed
 * in its sets, so it is not a property of them, as a split axis is not.
 */
export interface GenerationContractShape {
  /**
   * The shape's name, written into each set's name (`Primary Filled Icon Button`). At most one
   * shape has none: the component's ordinary sets, named without it.
   */
  name?: string;
  /** The values the shape holds, per axis. An axis not named holds every value. */
  values: Record<string, string[]>;
  /** The split of this shape's sets, when it differs from the contract's own. */
  split?: GenerationContractSplit;
}

/**
 * Generates a focus ring as a layer of the component. The root's `:focus-visible` outline becomes
 * an overlay part that sits outside the root, with its stroke width and colour bound from the
 * outline's tokens, shown by a boolean property that is off by default. The ring is a layer, not
 * a State value, so it multiplies no variants and shows on top of any state.
 */
export interface GenerationContractFocusRing {
  /** The boolean property that shows the ring. Defaults to `focus-visible`. */
  property?: string;
  /** Set by the compiler: the generated ring part. */
  part?: string;
  /** Set by the compiler: how far the ring's outer edge sits outside the root (offset + width). */
  insetPx?: number;
  /**
   * Set by the compiler instead of `insetPx` when a `:focus-visible` rule changes the offset for
   * some variants: the inset for each value of the one axis it follows.
   */
  insetPxByAxis?: { axis: string; values: Record<string, number> };
}

/**
 * A sub-element with its own states, generated as its own hidden component set and nested as an
 * instance in the parent. It is declared on the part, not on a slot: the part is the component's
 * own anatomy (not consumer content) and its styles are already in the component's stylesheet. The
 * compiler builds the set from the part's anatomy subtree over the block's own `axes`.
 */
export interface GenerationContractBuildingBlock {
  /** The declared part that becomes the block. It is not the root part. */
  part: string;
  /** The label in the set's name; defaults to the part's name without the component's prefix. */
  name?: string;
  /**
   * The block's own variant axes (its states). Each is complete: `values`, `default` and
   * `attribute`, as a design-only axis of the contract is, or names an axis of the parent by `prop`
   * alone (optionally curating it), and is then that axis. A parent that also lists an axis of the
   * same name shows the instance in the matching state; otherwise the instance shows the default.
   * The compiled contract carries every block axis complete.
   */
  axes: AuthoredContractAxis[];
  /**
   * Generates the block's focus ring as a layer, from the `:focus-visible` outline of the block's
   * part, as a contract's own `focusRing` does from its root's.
   */
  focusRing?: GenerationContractFocusRing;
  /**
   * One hidden set per value (or combination of values) of these block axes, as a contract's own
   * `split`: `.Building Blocks/<Component>/<Value> <Label>`. An instance shows the set that holds
   * its variant.
   */
  split?: GenerationContractSplit;
}

export interface FigmaGenerationContract {
  schemaVersion: typeof GENERATION_CONTRACT_SOURCE_SCHEMA_VERSION;
  slug: string;
  componentName: string;
  rootPart: string;
  /**
   * One-line component description shown under the title on the documentation page. Optional and
   * never hand-authored in a contract file: `figma:contract` stamps it from `registry.json`.
   */
  description?: string;
  /**
   * Build this contract from ANOTHER component's source: its stylesheet and TSX come from that
   * component's folder, and `rootPart` names one of that component's parts (a label, a legend)
   * rather than its root. The part then becomes its own Figma component, so a parent contract can
   * compose it (`composedChild`) the way the code composes the part. `slug` stays this contract's
   * own identity (component set name, composition target); the registry item, description and
   * category come from `source.slug`.
   */
  source?: GenerationContractSource;
  parts: string[];
  /** Explicit parent/child node tree consumed by the shared Figma materializer. */
  anatomy?: GenerationContractAnatomyNode;
  /** Consumer-fillable content associated with a visible component part. */
  slots?: GenerationContractSlot[];
  /** Figma component properties (text, boolean, instance swap) bound to declared parts. */
  properties?: GenerationContractProperty[];
  runtimeValues?: GenerationContractRuntimeValue[];
  axes: ComponentRegistryAxis[];
  /** One component set per value of this axis, instead of one set holding every variant. */
  split?: GenerationContractSplit;
  /** Kinds of the component that are generated as sets of their own (an icon-only button). */
  shapes?: GenerationContractShape[];
  /** The focus ring, generated as a layer from the root's `:focus-visible` outline. */
  focusRing?: GenerationContractFocusRing;
  /**
   * Why a set may hold more variants than Figma's library guidance allows (30). Without it, a set
   * over the cap is reported as a warning.
   */
  capReason?: string;
  /** Sub-elements with their own states, each generated as a hidden set nested in this one. */
  buildingBlocks?: GenerationContractBuildingBlock[];
  documentation: {
    examples: GenerationContractDocumentationExample[];
    /** Require examples to cover each value of every declared visual axis. */
    coverage?: "all-axes";
  };
  /** Reviewed differences between the React API and design-only display axes. */
  reactToFigmaNotes?: string[];
  /** Dimensions that CSS expresses as literals rather than bindable variables. */
  literalGeometry?: LiteralGeometry[];
  omittedParts?: Record<string, string | ClassifiedOmittedPart>;
  viewport?: GenerationContractViewport;
}

export const OMITTED_PART_KINDS = [
  "window-relative",
  "runtime-position",
  "unrepresentable-state",
] as const;

export type OmittedPartKind = (typeof OMITTED_PART_KINDS)[number];

export interface ClassifiedOmittedPart {
  kind: OmittedPartKind;
  reason: string;
  /** Required for `unrepresentable-state`: the omitted part this one is only reachable through. */
  via?: string;
}

export type ViewportPlacement = "center" | "docked" | "corner";

export type ViewportEdge = "top" | "right" | "bottom" | "left";
export type ViewportCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

/** Which frame edge each value of a component axis docks the popup to (`placement: "docked"`). */
export interface ViewportDock {
  /** The component axis whose value picks the docking edge (drawer's `side`). */
  axis: string;
  /** Axis value → edge, e.g. `{ down: "bottom", up: "top", right: "right", left: "left" }`. */
  edges: Record<string, ViewportEdge>;
}

export interface ViewportPopupWidth {
  source: string;
  /** Figma variable name of the CSS margin token, e.g. `spacing/600` — also the frame's inline padding. */
  marginVariable: string;
  /** The CSS `min()`'s own literal cap, in px. */
  maxWidthPx: number;
}

export interface GenerationContractViewport {
  placement: ViewportPlacement;
  /** Required for `placement: "docked"`. */
  dock?: ViewportDock;
  /** Required for `placement: "corner"`. */
  corner?: ViewportCorner;
  /**
   * The part whose OWN CSS places the popup, when that is not the root (toast: the root is one
   * notification card; its width cap and corner offsets live on `toast-viewport`, the stacking
   * container). Defaults to the contract's `rootPart`.
   */
  placementPart?: string;
  /**
   * A visible backdrop part that paints (dialog's scrim). Rendered from its own CSS-derived
   * bindings, stretched over the whole frame, behind the popup. Declared in `parts` but NOT in the
   * anatomy — the frame, not the popup, owns it. Backdrops that paint nothing stay in `omittedParts`.
   */
  backdropPart?: string;
  /** Reviewed prose: why this component is window-placed and what the frame stands in for. */
  reason: string;
  // ---- Compiler-computed (rejected when authored; required once compiled) ----
  /** The existing Figma variable that sizes the frame's width — `VIEWPORT_FRAME_WIDTH_VARIABLE`. */
  frameWidthVariable?: string;
  /**
   * Block padding of the frame — `--m` by name from the popup's `max-height: calc(100vh -
   * var(--m))`, when the CSS declares one. Omitted when it doesn't.
   */
  framePaddingBlock?: string;
  /**
   * Omitted when the root width is not the `min(calc(100vw - var(--m)), <cap>px)` shape; the popup
   * width then stays a reported refusal.
   */
  popupWidth?: ViewportPopupWidth;
  /**
   * `placement: "corner"`: the frame padding on the corner's two edges — the spacing token the
   * CSS `top|right|bottom|left: var(--x)` names, BY NAME (`spacing/400`).
   */
  cornerOffsets?: Partial<Record<ViewportEdge, string>>;
}

/**
 * One authored axis entry (D25). An axis the component source declares (a local `data-*`-driving
 * union type) may be restated in full, or name only its `prop` plus the curation that differs from
 * source: a subset or reordering of `values`, or another `default`. An axis the source does not
 * declare (a design-only or state axis, such as a window-placed popup's `context`) is complete.
 */
export type AuthoredContractAxis = Pick<ComponentRegistryAxis, "prop"> &
  Partial<Omit<ComponentRegistryAxis, "prop">>;

/**
 * The compiler's input shape: a normalized contract whose `axes` may be absent or sparse. The
 * compiler fills in every source axis, so `CompiledGenerationContract.contract` always holds the
 * full axes.
 */
export type AuthoredGenerationContract = Omit<FigmaGenerationContract, "axes"> & {
  axes?: AuthoredContractAxis[];
};

export interface CompileGenerationContractInput {
  contract: AuthoredGenerationContract;
  tsxSource: string;
  /** Absolute path of the component file, so imports of a union type resolve. */
  sourcePath?: string;
  cssSource: string;
  componentPath: string;
  stylesheetPath: string;
  resolveImageAsset?: (assetPath: string, componentPath: string) => { bytes: Uint8Array };
  /**
   * Verifies a `docsLayout.source` file reference actually exists — INJECTED
   * for the same reason `resolveImageAsset` is (this module is transitively
   * type-checked by the plugin's Node-less tsconfig). Node-context callers
   * (`figma-contract.ts`, this package's own tests) supply a real
   * filesystem-backed implementation; omitted means the file-existence half
   * of `docsLayout.source` validation is skipped (shape-only), never that the
   * requirement itself is skipped.
   */
  verifyDocsSource?: (docsFilePath: string) => boolean;
  documentationTheme: DocumentationTheme;
  layoutManifest?: Record<string, FigmaLayoutManifestEntry>;
  /**
   * The axes the component's own source declares, when the caller knows them better than the
   * extractor does: a Building Block's axes are all authored, so none come from the source.
   */
  sourceAxes?: ComponentRegistryAxis[];
  knownContractSlugs?: ReadonlySet<string>;
}

/**
 * A compiled Building Block: the contract and resolved plan of the hidden set generated for a
 * declared part. Its contract's `componentName` is the code name of the part (`SelectItem`); the
 * Figma name of the set comes from `buildingBlockSetName`.
 */
export interface CompiledBuildingBlock {
  /** The parent's declared part this block replaces with an instance. */
  part: string;
  contract: FigmaGenerationContract;
  resolvedPlan: ResolvedComponentPlan;
}

export interface CompiledGenerationContract {
  contract: FigmaGenerationContract;
  resolvedPlan: ResolvedComponentPlan;
  /** The hidden sets of the contract's Building Blocks, in declaration order. Absent when none. */
  buildingBlocks?: CompiledBuildingBlock[];
}

export interface GenerationContractArtifact {
  artifact: "focus.figma-generation-contract";
  version: typeof GENERATION_CONTRACT_ARTIFACT_SCHEMA_VERSION;
  documentationTheme: DocumentationTheme;
  documentationPage?: DocumentationPage;
  components: CompiledGenerationContract[];
}
