/**
 * The skill's ONLY input for per-component semantics: the compiled V2 Figma
 * generation artifact, `.agents/figma-generation-contract.json`.
 *
 * This is the same artifact the Figma plugin walks — compiled by
 * `bun run figma:contract` from the co-located `<name>.figma.contract.ts` files.
 * One contract, two materializers: the plugin's node walker and this skill's
 * planner + emitter both read it, so a contract change is made once.
 *
 * The skill is copied verbatim into `~/.agents/skills/` and must stay
 * standalone, so it cannot import `@focus/figma-generators`. The types below
 * are a structural mirror of the parts of `GenerationContractArtifact` the skill
 * reads; the skill's tests parse the real artifact with both this reader and the
 * canonical validator and assert the supported versions match, so the mirror
 * cannot silently drift.
 *
 * PURE: no fs, no Date/random. The caller reads the file and passes its text
 * (or `null` when the file does not exist).
 *
 * There is deliberately NO fallback. An absent or version-mismatched artifact is
 * a loud error with remediation — never a reason to infer variant axes, parts or
 * slots from component source. Generic inference is deterministically incomplete
 * and produces a library that looks generated while silently missing
 * compound composition, runtime display states, literal geometry and assets.
 */

/** Repository-relative path of the compiled artifact in every project. */
export const GENERATION_ARTIFACT_PATH = ".agents/figma-generation-contract.json";

/** The artifact identity string (`artifact` field). */
export const GENERATION_ARTIFACT_IDENTITY = "focus.figma-generation-contract";

/** Artifact schema version this skill reads. Mirrors `GENERATION_CONTRACT_ARTIFACT_SCHEMA_VERSION`. */
export const SUPPORTED_ARTIFACT_VERSION = 2;

/** Resolved-plan schema version this skill reads. Mirrors `RESOLVED_PLAN_SCHEMA_VERSION`. */
export const SUPPORTED_RESOLVED_PLAN_VERSION = 3;

// ---------- Structural mirror of the artifact (subset the skill reads) ----------

/** The closed documentation-chrome role vocabulary (`documentationTheme`). */
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

/**
 * Project-level documentation-page content that is not a design token (`documentationPage`):
 * where the written docs live and the brand wordmark. Every field is optional — an absent field
 * omits the matching element from the page rather than rendering a placeholder.
 */
export interface DocumentationPage {
  /** Origin + path prefix of the component docs; the page links to `${docsBaseUrl}/${slug}`. */
  docsBaseUrl?: string;
  /** Wordmark shown in the page header. */
  brandName?: string;
}

/** A visual axis as declared by the contract. */
export interface ContractAxis {
  prop: string;
  values: string[];
  default: string;
  attribute?: string;
  valueSelectors?: Record<string, string | null>;
}

/** Consumer-fillable content tied to a part. */
export interface ContractSlot {
  name: string;
  part: string;
  required?: boolean;
  composedChild?: {
    component: string;
    variantKey?: Record<string, string>;
    variantKeyFromAxes?: Record<string, string>;
  };
  /** The default content is the anatomy subtree beneath the frame that names this slot. */
  defaultContent?: "anatomy";
  /** The slot's frame fills its parent's cross axis. */
  stretch?: boolean;
}

/**
 * A Figma component property the contract declares beside its variant axes: editable text, a part
 * that shows or hides, or a swappable icon. Each is bound to one declared part.
 */
export type ContractProperty =
  | { type: "text"; name: string; part: string; default: string; codeProp?: string }
  | {
      type: "boolean";
      name: string;
      part: string;
      default: boolean;
      /** Variant cells where the part is always shown and the property does not apply. */
      unless?: Record<string, string | string[]>;
      codeProp?: string;
      contentPresence?: boolean;
    }
  | { type: "instanceSwap"; name: string; part: string; codeProp?: string };

/**
 * One node of the contract's explicit anatomy tree. Only the fields every
 * consumer needs are named; geometry, icon and asset fields (`iconSvg`,
 * `imageData`, `layout`, …) are carried through untouched for the emitter.
 */
export interface ContractAnatomyNode {
  part: string;
  kind: "frame" | "text" | "icon" | "rectangle" | "ellipse" | "image";
  slots?: string[];
  children?: ContractAnatomyNode[];
  [field: string]: unknown;
}

export interface ContractDocumentationExample {
  label: string;
  key: Record<string, string>;
  slots?: Record<string, string>;
  /**
   * this example's value for each declared runtime value, as a percent
   * string in `[0, 100]` (`"40"`). Authored, never measured.
   */
  runtimeValues?: Record<string, string>;
}

/**
 * a value the browser measures at runtime (a tab's width, a scroll
 * position), declared by the contract so Figma renders an authored example instead of a guess.
 */
export interface ContractRuntimeValue {
  name: string;
  part: string;
  /** `length`: a size; `travel`: a position through the parent's free space. */
  measures: "length" | "travel";
  /** The runtime custom properties (`--active-tab-width`) this value stands in for in `part`'s CSS. */
  replaces: string[];
  reason: string;
}

export type ViewportPlacement = "center" | "docked" | "corner";
export type ViewportEdge = "top" | "right" | "bottom" | "left";

/**
 * Window-placed components: a window-placed component (dialog, drawer, toast)
 * is generated inside a viewport stand-in frame. The `frameWidthVariable`, `framePaddingBlock`,
 * `popupWidth` and `cornerOffsets` fields are computed by the contract build from the
 * component's CSS; the skill reads them and computes nothing.
 */
export interface ContractViewport {
  placement: ViewportPlacement;
  /** `docked`: the axis whose value picks the edge (drawer's `side`), and value to edge. */
  dock?: { axis: string; edges: Record<string, ViewportEdge> };
  /** `corner`: `"<top|bottom>-<left|right>"`. */
  corner?: string;
  /** The part whose own CSS places the popup, when not the root (toast's `toast-viewport`). */
  placementPart?: string;
  /** A visible backdrop part, rendered from its own CSS-derived bindings behind the popup. */
  backdropPart?: string;
  reason: string;
  frameWidthVariable?: string;
  framePaddingBlock?: string;
  popupWidth?: { source: string; marginVariable: string; maxWidthPx: number };
  cornerOffsets?: Partial<Record<ViewportEdge, string>>;
}

/** The axis (or axes, joined in order) whose values each get a component set of their own. */
export interface ContractSplit {
  axis: string | string[];
}

/** One kind of the component: the values it holds per axis, and its own split when it has one. */
export interface ContractShape {
  name?: string;
  values: Record<string, string[]>;
  split?: ContractSplit;
}

/** A sub-element generated as hidden sets of its own, nested in the parent's variants as instances. */
export interface ContractBuildingBlock {
  part: string;
  name?: string;
  split?: ContractSplit;
  axes: Array<Partial<ContractAxis> & { prop: string }>;
}

/** The focus ring layer: how far its outer edge sits outside the root, for every variant or per axis value. */
export interface ContractFocusRing {
  part?: string;
  property?: string;
  insetPx?: number;
  insetPxByAxis?: { axis: string; values: Partial<Record<string, number>> };
}

export interface GenerationContract {
  schemaVersion: number;
  slug: string;
  componentName: string;
  rootPart: string;
  /** One-line description shown under the page title; the line is omitted when absent. */
  description?: string;
  parts: string[];
  anatomy?: ContractAnatomyNode;
  slots?: ContractSlot[];
  /** Text, boolean and instance-swap properties added to the component set. */
  properties?: ContractProperty[];
  axes: ContractAxis[];
  /** The component this contract is a Building Block of; its slug prefixes the block's parts. */
  source?: { slug: string };
  /** One component set per value of this axis (or per combination of these axes). */
  split?: ContractSplit;
  /** Kinds of the component, each generated as sets of its own. */
  shapes?: ContractShape[];
  /** The contract's written reason for a set to exceed the variant cap. */
  capReason?: string;
  /** The focus ring layer, generated from the root's outline and placed outside it. */
  focusRing?: ContractFocusRing;
  /** Sub-elements with their own states, each generated as hidden sets nested as instances. */
  buildingBlocks?: ContractBuildingBlock[];
  documentation: { examples: ContractDocumentationExample[]; coverage?: "all-axes" };
  reactToFigmaNotes?: string[];
  literalGeometry?: Array<Record<string, unknown> & { part: string }>;
  omittedParts?: Record<string, string>;
  /** the runtime-measured values this contract declares. */
  runtimeValues?: ContractRuntimeValue[];
  /** Present only for a window-placed component. */
  viewport?: ContractViewport;
}

/** Fill/text/stroke bindings as Figma variable NAMES. */
export interface ResolvedBinding {
  fill?: string;
  /** The fill's strength as a fraction, when the CSS mixes it with `transparent`. */
  fillOpacity?: number;
  text?: string;
  stroke?: string;
  /** The stroke's strength as a fraction, when the CSS mixes it with `transparent`. */
  strokeOpacity?: number;
  effectStyle?: string;
  /** The stroke is `currentColor`: draw it in the node's resolved text colour. */
  strokeFromText?: true;
}

/**
 * A resolved box dimension, kept as its SHAPE: sizing is several
 * Figma mechanisms, and only the shape says which applies. Mirrors the plugin
 * side's `ResolvedDimension`; `geometry.ts` turns it into a sizing decision.
 */
export type ResolvedDimension =
  | { kind: "variable"; variable: string }
  | { kind: "fill" }
  | { kind: "literal"; px: number }
  | { kind: "hug" }
  | { kind: "unsupported"; value: string }
  | { kind: "runtime"; property: string };

/**
 * Geometry bindings as variable / text-style NAMES, plus the box (`width`/`height`
 * by shape, `aspectRatio`) and layout enums `geometry.ts` reads. Other fields are
 * carried through untouched.
 */
export interface ResolvedGeometry {
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
  textStyle?: string;
  opacity?: string;
  width?: ResolvedDimension;
  height?: ResolvedDimension;
  /** `flex-grow` intent — parent-relative, so it never applies to a variant root. */
  growsOnMainAxis?: boolean;
  layoutMode?: "HORIZONTAL" | "VERTICAL";
  primaryAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
  counterAxisAlignItems?: "MIN" | "CENTER" | "MAX";
  /** `align-self` on a flex child: carried by the parent's `counterAxisAlignItems`; a node naming one is refused. */
  alignSelf?: "MIN" | "CENTER" | "MAX";
  aspectRatio?: number;
  [field: string]: unknown;
}

/** One cell of the resolved variant matrix. */
export interface ResolvedCell {
  key: Record<string, string>;
  label: string;
  bind: ResolvedBinding;
  iconName?: string;
  iconSvg?: string;
  /** Present when this cell's geometry differs from `baseGeometry`. */
  geometry?: ResolvedGeometry;
}

/** A resolved corner radius on a composed-child instance: a Figma variable name, or a px that was already literal in the CSS. */
export type ComposedChildRadiusValue = { kind: "variable"; name: string } | { kind: "literal"; px: number };

/**
 * The descendant overrides a PARENT's CSS applies to an instance of a
 * composed child: per-corner radius, fill, stroke, effect style. Applied to the
 * INSTANCE only, never to the child's own component.
 */
export interface ComposedChildOverrideBinding {
  fill?: string;
  stroke?: string;
  effectStyle?: string;
  topLeftRadius?: ComposedChildRadiusValue;
  topRightRadius?: ComposedChildRadiusValue;
  bottomLeftRadius?: ComposedChildRadiusValue;
  bottomRightRadius?: ComposedChildRadiusValue;
  /**
   * The instance's height: a computed px literal, or `fill` where the item is exactly its
   * parent's padded track (it stretches across the cross axis).
   */
  height?: { kind: "literal"; px: number } | { kind: "fill" };
}

/** One parent variant cell's overrides, keyed by the composed-child slot's 0-based repeat index. */
export interface ComposedChildOverrideCell {
  key: Record<string, string>;
  positions: Record<number, ComposedChildOverrideBinding>;
}

export interface ResolvedPlan {
  schemaVersion: number;
  component: string;
  parts: string[];
  variantAxes: Array<{ prop: string; values: string[]; default: string }>;
  variantMatrix: ResolvedCell[];
  gridLabels: { rows: string[]; cols: string[] } | null;
  baseGeometry: ResolvedGeometry;
  partBindings?: Record<string, ResolvedCell[]>;
  /** Per composed-child slot name: the parent's resolved instance overrides, per parent cell. */
  composedChildOverrides?: Record<string, ComposedChildOverrideCell[]>;
  [field: string]: unknown;
}

/** One compiled component: the reviewed contract plus its build-time resolved plan. */
export interface ArtifactComponent {
  contract: GenerationContract;
  resolvedPlan: ResolvedPlan;
  /** Each declared Building Block, compiled as a component of its own (its contract and plan). */
  buildingBlocks?: ArtifactBuildingBlock[];
}

/** One compiled Building Block: the part it renders in the parent, and its own contract and plan. */
export interface ArtifactBuildingBlock {
  part: string;
  contract: GenerationContract;
  resolvedPlan: ResolvedPlan;
}

export interface GenerationArtifact {
  artifact: typeof GENERATION_ARTIFACT_IDENTITY;
  version: typeof SUPPORTED_ARTIFACT_VERSION;
  documentationTheme: DocumentationTheme;
  documentationPage?: DocumentationPage;
  components: ArtifactComponent[];
}

// ---------- Errors (loud, with remediation) ----------

export type GenerationArtifactErrorCode = "missing" | "invalid-json" | "wrong-identity" | "version-mismatch" | "malformed" | "unknown-component";

/**
 * Raised whenever the artifact cannot be used. The message always ends with
 * remediation the agent relays to the user verbatim. There is no recoverable
 * variant: the skill stops.
 */
export class GenerationArtifactError extends Error {
  readonly code: GenerationArtifactErrorCode;
  constructor(code: GenerationArtifactErrorCode, message: string) {
    super(message);
    this.name = "GenerationArtifactError";
    this.code = code;
  }
}

const REGENERATE =
  "Run `bun run figma:contract` to compile it from the co-located `<name>.figma.contract.ts` files, " +
  "commit the result, and re-run the skill.";
const NO_CONTRACTS =
  "If the project has no `*.figma.contract.ts` files it predates the V2 contract: use the Figma " +
  "plugin flow (`.agents/figma-plugin-flow.md`) instead.";
const NEVER_INFER = "Do not infer component semantics from source instead.";

function fail(code: GenerationArtifactErrorCode, problem: string, remediation: string): never {
  throw new GenerationArtifactError(code, `${problem} ${remediation} ${NEVER_INFER}`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function malformed(path: string, expected: string): never {
  return fail(
    "malformed",
    `${GENERATION_ARTIFACT_PATH} is malformed: \`${path}\` must be ${expected}.`,
    `The file was hand-edited or truncated. ${REGENERATE}`,
  );
}

// ---------- Reader ----------

/**
 * Parse and check the generation artifact. Pass the file's text, or `null` /
 * `undefined` when the file does not exist.
 *
 * Checks identity, schema versions and the shape of every field the planner
 * reads. It does NOT re-run the canonical validator (contract/plan alignment,
 * composition cycles) — the compiler already enforced those when it wrote the
 * file, and `bun run figma:contract:check` keeps the committed copy honest.
 */
export function parseGenerationArtifact(text: string | null | undefined): GenerationArtifact {
  if (text === null || text === undefined) {
    fail("missing", `${GENERATION_ARTIFACT_PATH} does not exist.`, `${REGENERATE} ${NO_CONTRACTS}`);
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    fail("invalid-json", `${GENERATION_ARTIFACT_PATH} is not valid JSON.`, REGENERATE);
  }

  if (!isObject(value)) malformed("<root>", "an object");
  if (value.artifact !== GENERATION_ARTIFACT_IDENTITY) {
    fail(
      "wrong-identity",
      `${GENERATION_ARTIFACT_PATH} is not a Figma generation artifact (expected \`artifact: "${GENERATION_ARTIFACT_IDENTITY}"\`).`,
      REGENERATE,
    );
  }
  if (value.version !== SUPPORTED_ARTIFACT_VERSION) {
    fail(
      "version-mismatch",
      `${GENERATION_ARTIFACT_PATH} has version ${JSON.stringify(value.version)}; this skill reads version ${SUPPORTED_ARTIFACT_VERSION}.`,
      typeof value.version === "number" && value.version > SUPPORTED_ARTIFACT_VERSION
        ? "The artifact is newer than the skill. Update the skill (`shadcn add @focus/skill-figma-generate`) and re-run."
        : `The artifact is older than the skill. ${REGENERATE}`,
    );
  }
  if (!isObject(value.documentationTheme)) malformed("documentationTheme", "an object");
  if (value.documentationPage !== undefined) {
    const page = value.documentationPage;
    if (!isObject(page)) malformed("documentationPage", "an object");
    for (const field of ["docsBaseUrl", "brandName"] as const) {
      if (page[field] !== undefined && typeof page[field] !== "string") malformed(`documentationPage.${field}`, "a string");
    }
  }
  if (!Array.isArray(value.components) || value.components.length === 0) {
    malformed("components", "a non-empty array");
  }

  for (const [index, entry] of value.components.entries()) {
    checkComponent(entry, `components[${index}]`);
  }
  return value as unknown as GenerationArtifact;
}

function checkComponent(entry: unknown, path: string): void {
  if (!isObject(entry)) malformed(path, "an object");
  const { contract, resolvedPlan } = entry;
  if (!isObject(contract)) malformed(`${path}.contract`, "an object");
  if (!isObject(resolvedPlan)) malformed(`${path}.resolvedPlan`, "an object");

  for (const field of ["slug", "componentName", "rootPart"] as const) {
    if (typeof contract[field] !== "string" || !contract[field]) malformed(`${path}.contract.${field}`, "a non-empty string");
  }
  if (contract.description !== undefined && typeof contract.description !== "string") {
    malformed(`${path}.contract.description`, "a string");
  }
  if (!isStringArray(contract.parts)) malformed(`${path}.contract.parts`, "a string array");
  if (!Array.isArray(contract.axes)) malformed(`${path}.contract.axes`, "an array");
  if (!isObject(contract.documentation) || !Array.isArray(contract.documentation.examples)) {
    malformed(`${path}.contract.documentation.examples`, "an array");
  }

  if (resolvedPlan.schemaVersion !== SUPPORTED_RESOLVED_PLAN_VERSION) {
    fail(
      "version-mismatch",
      `${GENERATION_ARTIFACT_PATH}: \`${path}.resolvedPlan.schemaVersion\` is ${JSON.stringify(resolvedPlan.schemaVersion)}; this skill reads ${SUPPORTED_RESOLVED_PLAN_VERSION}.`,
      REGENERATE,
    );
  }
  if (resolvedPlan.component !== contract.componentName) {
    malformed(`${path}.resolvedPlan.component`, `equal to the contract componentName "${contract.componentName as string}"`);
  }
  if (!isStringArray(resolvedPlan.parts)) malformed(`${path}.resolvedPlan.parts`, "a string array");
  if (!Array.isArray(resolvedPlan.variantAxes)) malformed(`${path}.resolvedPlan.variantAxes`, "an array");
  if (!Array.isArray(resolvedPlan.variantMatrix)) malformed(`${path}.resolvedPlan.variantMatrix`, "an array");
  resolvedPlan.variantMatrix.forEach((cell, index) => {
    const cellPath = `${path}.resolvedPlan.variantMatrix[${index}]`;
    if (!isObject(cell) || !isObject(cell.key) || typeof cell.label !== "string" || !isObject(cell.bind)) {
      malformed(cellPath, "a cell with `key`, `label` and `bind`");
    }
  });
  if (resolvedPlan.gridLabels !== null && !isObject(resolvedPlan.gridLabels)) {
    malformed(`${path}.resolvedPlan.gridLabels`, "an object or null");
  }
  if (!isObject(resolvedPlan.baseGeometry)) malformed(`${path}.resolvedPlan.baseGeometry`, "an object");
  checkGeometry(resolvedPlan.baseGeometry, `${path}.resolvedPlan.baseGeometry`);
  resolvedPlan.variantMatrix.forEach((cell: Record<string, unknown>, index) => {
    if (cell.geometry === undefined) return;
    const cellPath = `${path}.resolvedPlan.variantMatrix[${index}].geometry`;
    if (!isObject(cell.geometry)) malformed(cellPath, "an object");
    checkGeometry(cell.geometry, cellPath);
  });
  // Each declared Building Block is compiled as a component of its own, so it is checked as one.
  const declared = blockEntries(contract.buildingBlocks, `${path}.contract.buildingBlocks`);
  const compiled = blockEntries(entry.buildingBlocks, `${path}.buildingBlocks`);
  for (const block of declared) {
    if (!compiled.some((candidate) => candidate.part === block.part)) {
      malformed(`${path}.buildingBlocks`, `a compiled Building Block for part "${block.part}"`);
    }
  }
  // Every compiled entry is planned, a declared one or not, so each is checked.
  for (const [index, block] of compiled.entries()) {
    checkComponent(block, `${path}.buildingBlocks[${index}]`);
  }
}

/** A Building Block list: absent, or an array of objects that each name a part. */
function blockEntries(value: unknown, path: string): Array<Record<string, unknown> & { part: string }> {
  if (value === undefined) return [];
  if (!Array.isArray(value)) malformed(path, "an array");
  value.forEach((block, index) => {
    if (!isObject(block) || typeof block.part !== "string" || !block.part) malformed(`${path}[${index}]`, "an object with a non-empty string `part`");
  });
  return value as Array<Record<string, unknown> & { part: string }>;
}

/**
 * A declared box dimension must at least be a `{ kind: string }` object. An
 * UNKNOWN kind is not rejected here — `geometry.ts` refuses and reports it per
 * cell, which names the node — but a shapeless value would be guessed at.
 */
function checkGeometry(geometry: Record<string, unknown>, path: string): void {
  for (const axis of ["width", "height"] as const) {
    const dimension = geometry[axis];
    if (dimension === undefined) continue;
    if (!isObject(dimension) || typeof dimension.kind !== "string") {
      malformed(`${path}.${axis}`, "a dimension object with a string `kind`");
    }
  }
}

/**
 * Look a component up by contract `slug` (`button`) or `componentName`
 * (`Button`). Throws, with the available slugs, when the artifact has no such
 * component — it never synthesises one.
 */
export function findArtifactComponent(artifact: GenerationArtifact, slugOrName: string): ArtifactComponent {
  const found = artifact.components.find(
    (entry) => entry.contract.slug === slugOrName || entry.contract.componentName === slugOrName,
  );
  if (!found) {
    fail(
      "unknown-component",
      `${GENERATION_ARTIFACT_PATH} has no component "${slugOrName}". Available: ${artifact.components
        .map((entry) => entry.contract.slug)
        .join(", ")}.`,
      "Add a co-located `<name>.figma.contract.ts` for it, then run `bun run figma:contract`.",
    );
  }
  return found;
}
