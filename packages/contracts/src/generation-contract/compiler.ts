import { resolveIconSvg } from "../icons";
import { PAINT_OR_TEXT_CSS_PROPERTIES, parseComponentCss } from "../registry";
import { extractComponentRegistry } from "../registry/extract-registry";
import {
  cssVarToFigmaVariableName,
  type PseudoElementSuffix,
  resolveComposedChildOverrides,
} from "../registry/resolver";
import type { ComponentRegistryAxis } from "../registry/types";
import { resolvedPlanFromComponentSource } from "../resolved-plan";
import type {
  ResolvedComponentPlan,
  ResolvedDimension,
  ResolvedPlanCell,
  ResolvedPlanGeometry,
} from "../resolved-plan/types";
import { mapAlignSelfToParent } from "./align-self-to-parent";
import { normalizeContractAxes } from "./axes";
import { applyColumnStretch } from "./block-stretch";
import { buildingBlockContract } from "./building-blocks";
import { buildingBlockParts, componentSetErrors } from "./component-sets";
import { anatomyNodes, validateComposition } from "./composition";
import { diagnosticPath, refusal } from "./diagnostics";
import { fillComposedChildInsets } from "./fill-inset";
import {
  expandFocusRing,
  focusRingAxes,
  focusRingPlacement,
  readFocusRingMetrics,
  withFocusRingBindings,
} from "./focus-ring";
import { mapLayoutIntents } from "./layout-intents";
import { mapMarginsToLayout } from "./margins-to-layout";
import { normalizeComposedChildKeys, normalizeExampleKeys } from "./normalize";
import { propertyErrors } from "./properties";
import { resolveByAxis } from "./resolve-by-axis";
import { runtimeValueErrors, slotNameOf } from "./runtime-values";
import type {
  ClassifiedOmittedPart,
  CompiledBuildingBlock,
  CompiledGenerationContract,
  CompileGenerationContractInput,
  DocumentationPage,
  DocumentationTheme,
  FigmaGenerationContract,
  GenerationContractAnatomyNode,
  GenerationContractArtifact,
  GenerationContractSlot,
  LiteralGeometry,
} from "./types";
import {
  DOCS_LAYOUT_ALIGN_VALUES,
  DOCS_LAYOUT_GAP_TOKEN_RE,
  DOCS_LAYOUT_JUSTIFY_VALUES,
  DOCUMENTATION_THEME_ROLES,
  GENERATION_CONTRACT_ARTIFACT_SCHEMA_VERSION,
  type GenerationContractBindingRole,
  MAX_EMBEDDED_ASSET_BYTES,
  OMITTED_PART_KINDS,
  parseDocsLayoutSource,
  SUPPORTED_IMAGE_ASSET_MIME_TYPES,
  type SupportedImageAssetExtension,
} from "./types";
import { assertAuthoredViewport, compileViewport } from "./viewport";

function validateDocsLayout(
  node: GenerationContractAnatomyNode,
  slug: string,
  verifyDocsSource?: (docsFilePath: string) => boolean,
): void {
  const docsLayout = node.docsLayout;
  if (!docsLayout) return;
  if (!node.synthetic) {
    throw new Error(
      `"${slug}" anatomy part "${node.part}" declares docsLayout but is not synthetic — docsLayout ` +
        "is only allowed on a synthetic composed-child container.",
    );
  }
  if (typeof docsLayout.source !== "string" || !docsLayout.source.trim()) {
    throw new Error(
      `"${slug}" anatomy part "${node.part}" docsLayout.source is required (must name the docs ` +
        'file + line that authors this layout, e.g. "apps/docs/content/docs/components/dialog.mdx:26").',
    );
  }
  const parsedSource = parseDocsLayoutSource(docsLayout.source);
  if (!parsedSource) {
    throw new Error(
      `"${slug}" anatomy part "${node.part}" docsLayout.source "${docsLayout.source}" must be ` +
        'shaped "<docs file path>:<line>".',
    );
  }
  if (verifyDocsSource && !verifyDocsSource(parsedSource.path)) {
    throw new Error(
      `"${slug}" anatomy part "${node.part}" docsLayout.source names "${parsedSource.path}", ` +
        "which does not exist.",
    );
  }
  if (docsLayout.gap !== undefined && !DOCS_LAYOUT_GAP_TOKEN_RE.test(docsLayout.gap)) {
    throw new Error(
      `"${slug}" anatomy part "${node.part}" docsLayout.gap "${docsLayout.gap}" must be a bare ` +
        '"var(--token-name)" reference — a literal px/rem value or calc() is rejected, not ' +
        "reproduced (the docs markup must author a TOKEN, not a raw length).",
    );
  }
  if (docsLayout.justify !== undefined && !DOCS_LAYOUT_JUSTIFY_VALUES.has(docsLayout.justify)) {
    throw new Error(
      `"${slug}" anatomy part "${node.part}" docsLayout.justify "${docsLayout.justify}" must be ` +
        "one of start, center, end, space-between.",
    );
  }
  if (docsLayout.align !== undefined && !DOCS_LAYOUT_ALIGN_VALUES.has(docsLayout.align)) {
    throw new Error(
      `"${slug}" anatomy part "${node.part}" docsLayout.align "${docsLayout.align}" must be one ` +
        "of start, center, end, stretch.",
    );
  }
}

/**
 * Resolve the binding value for a given role from a cell's bind + geometry.
 * textStyle lives in geometry (CSS composite type); all other roles are in bind.
 */
export function resolveRole(
  role: GenerationContractBindingRole,
  bind: Record<string, unknown> | undefined,
  geometry: Record<string, unknown> | undefined,
  baseGeometry: Record<string, unknown> | undefined,
): unknown {
  if (role === "textStyle") return geometry?.textStyle ?? baseGeometry?.textStyle;
  return bind?.[role];
}

/** Throws unless every documentation theme role is bound to a variable. */
function requireTheme(theme: DocumentationTheme): void {
  for (const role of DOCUMENTATION_THEME_ROLES) {
    const variable = theme[role];
    if (typeof variable !== "string" || !variable.trim())
      throw new Error(`Documentation theme role "${role}" requires a variable.`);
  }
}

/** Whether two documentation themes bind every role to the same variable. */
function sameTheme(a: DocumentationTheme, b: DocumentationTheme): boolean {
  return DOCUMENTATION_THEME_ROLES.every((role) => a[role] === b[role]);
}

/**
 * Whether the contract and the resolved plan agree on each axis name, values and default, in
 * order.
 */
function sameAxes(
  contract: FigmaGenerationContract,
  resolved: CompiledGenerationContract["resolvedPlan"],
): boolean {
  return (
    JSON.stringify(
      contract.axes.map(({ prop, values, default: defaultValue }) => ({
        prop,
        values,
        defaultValue,
      })),
    ) ===
    JSON.stringify(
      resolved.variantAxes.map(({ prop, values, default: defaultValue }) => ({
        prop,
        values,
        defaultValue,
      })),
    )
  );
}

/** Whether two variant keys hold exactly the same axis values. */
function sameKey(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

/**
 * Does every axis/value pair in `condition` match `key`? A value may be a
 * single string (exact match) or a string array (matches ANY of them) — see
 * `GenerationContractAnatomyNode.when`/`unless`. An absent condition matches
 * vacuously (`{}`'s `every` is trivially true) — callers decide what that
 * means for `when` (always visible) vs `unless` (never omit, handled by only
 * calling this when `unless` is actually present).
 */
function matchesCondition(
  key: Record<string, string>,
  condition: Record<string, string | string[]> | undefined,
): boolean {
  return Object.entries(condition ?? {}).every(([axis, value]) =>
    Array.isArray(value) ? value.includes(key[axis]) : key[axis] === value,
  );
}

/** Orders two strings by code point so output does not depend on locale. */
function compareCodepoints(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** For `all-axes` coverage, throws when an axis value has no documentation example. */
function requiresCompleteDocumentation(contract: FigmaGenerationContract): void {
  if (contract.documentation.coverage !== "all-axes") return;
  for (const axis of contract.axes) {
    for (const value of axis.values) {
      if (!contract.documentation.examples.some((example) => example.key[axis.prop] === value)) {
        throw new Error(
          `"${contract.slug}" documentation does not cover ${axis.prop} value "${value}".`,
        );
      }
    }
  }
}

function pseudoPartsFromContract(
  contract: FigmaGenerationContract,
): Array<{ part: string; hostPart: string; pseudo: PseudoElementSuffix }> {
  const requests: Array<{ part: string; hostPart: string; pseudo: PseudoElementSuffix }> = [];
  for (const part of contract.parts) {
    const pseudoIndex = part.indexOf("::");
    if (pseudoIndex === -1) continue;
    const suffix = part.slice(pseudoIndex) as PseudoElementSuffix;
    const hostPart = part.slice(0, pseudoIndex);
    requests.push({ part, hostPart, pseudo: suffix });
  }
  return requests;
}

/**
 * Throws when a slot has no name, repeats a name, targets an undeclared part or has a composed
 * child with no component.
 */
function validateSlots(contract: FigmaGenerationContract): void {
  const slots = contract.slots ?? [];
  const names = new Set<string>();
  for (const slot of slots) {
    if (!slot.name.trim()) throw new Error(`"${contract.slug}" has a slot without a name.`);
    if (names.has(slot.name))
      throw new Error(`"${contract.slug}" declares slot "${slot.name}" twice.`);
    if (!contract.parts.includes(slot.part)) {
      throw new Error(
        `"${contract.slug}" slot "${slot.name}" references undeclared part "${slot.part}".`,
      );
    }
    if (slot.composedChild && !slot.composedChild.component.trim()) {
      throw new Error(`"${contract.slug}" slot "${slot.name}" composed child has no component.`);
    }
    if (slot.defaultContent) {
      if (slot.composedChild) {
        throw new Error(
          `"${contract.slug}" slot "${slot.name}" cannot declare both defaultContent and composedChild.`,
        );
      }
      const holder = anatomyNodes(contract.anatomy).find((node) => node.part === slot.part);
      if (!holder || holder.kind !== "frame" || !holder.children?.length) {
        throw new Error(
          `"${contract.slug}" slot "${slot.name}" declares defaultContent, so its part "${slot.part}" must be a frame anatomy node with children.`,
        );
      }
    }
    names.add(slot.name);
  }
  for (const example of contract.documentation.examples) {
    for (const slot of slots) {
      if (
        slot.required &&
        !slot.composedChild &&
        !slot.defaultContent &&
        !(slot.name in (example.slots ?? {}))
      ) {
        throw new Error(
          `"${contract.slug}" example "${example.label}" is missing required slot "${slot.name}".`,
        );
      }
    }
    for (const name of Object.keys(example.slots ?? {})) {
      if (!names.has(name)) {
        throw new Error(
          `"${contract.slug}" example "${example.label}" provides undeclared slot "${name}".`,
        );
      }
    }
  }
}

/**
 * Throws when a declared literal size has no matching part or contradicts the resolved geometry.
 */
function validateLiteralGeometry(
  contract: FigmaGenerationContract,
  literalGeometry: LiteralGeometry[] | undefined,
  resolved: CompiledGenerationContract["resolvedPlan"],
): void {
  for (const literal of literalGeometry ?? []) {
    if (!contract.parts.includes(literal.part)) {
      throw new Error(
        `"${contract.slug}" literal geometry part "${literal.part}" is not declared.`,
      );
    }
    if (
      literal.width === undefined &&
      literal.height === undefined &&
      literal.fontSize === undefined &&
      literal.lineHeight === undefined
    ) {
      throw new Error(`"${contract.slug}" literal geometry for "${literal.part}" is empty.`);
    }
    for (const [dimension, value] of Object.entries(literal)) {
      if (dimension === "part" || dimension === "when" || dimension === "lineHeightUnit") continue;
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        throw new Error(
          `"${contract.slug}" literal geometry "${dimension}" for "${literal.part}" must be positive.`,
        );
      }
      if (literal.lineHeightUnit !== undefined && literal.lineHeight === undefined) {
        throw new Error(
          `"${contract.slug}" literal geometry line-height unit for "${literal.part}" requires lineHeight.`,
        );
      }
    }
    for (const [axis, value] of Object.entries(literal.when ?? {})) {
      const knownAxis = contract.axes.find((candidate) => candidate.prop === axis);
      if (!knownAxis?.values.includes(value)) {
        throw new Error(
          `"${contract.slug}" literal geometry for "${literal.part}" has unknown ${axis} value "${value}".`,
        );
      }
    }
    if (
      !resolved.variantMatrix.some((cell) =>
        Object.entries(literal.when ?? {}).every(([axis, value]) => cell.key[axis] === value),
      )
    ) {
      throw new Error(
        `"${contract.slug}" literal geometry for "${literal.part}" does not match a resolved variant.`,
      );
    }
  }
}

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Encode raw bytes as base64 with no dependency on Node's `Buffer` — this module is transitively
 * type-checked under the Figma plugin's Node-free tsconfig (see `CompileGenerationContractInput
 * .resolveImageAsset`'s docblock), so it stays dependency-free like the rest of this file.
 */
function encodeBase64(bytes: Uint8Array): string {
  let result = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    const chunk = (b0 << 16) | ((b1 ?? 0) << 8) | (b2 ?? 0);
    result += BASE64_CHARS[(chunk >> 18) & 0x3f];
    result += BASE64_CHARS[(chunk >> 12) & 0x3f];
    result += b1 === undefined ? "=" : BASE64_CHARS[(chunk >> 6) & 0x3f];
    result += b2 === undefined ? "=" : BASE64_CHARS[chunk & 0x3f];
  }
  return result;
}

/** Lowercased file extension (including the dot), with no dependency on Node's `path` module. */
function fileExtension(path: string): string {
  const lastDot = path.lastIndexOf(".");
  const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (lastDot <= lastSlash) return "";
  return path.slice(lastDot).toLowerCase();
}

/**
 * Validate and base64-encode a `kind: "image"` node's declared local asset — the same
 * build-time-embedding idea as `resolveIconSvg` above, but for a file on disk rather than a name
 * in a registry, since anatomy images aren't a closed set the way Phosphor icons are. The actual
 * file read is the CALLER's job (`input.resolveImageAsset`) — see that field's docblock for why.
 */
function embedImageAsset(
  contract: Pick<FigmaGenerationContract, "slug">,
  node: GenerationContractAnatomyNode,
  componentPath: string,
  resolveImageAsset: CompileGenerationContractInput["resolveImageAsset"],
): { imageData: string; imageMimeType: string } {
  if (!node.imageAssetPath) {
    throw new Error(`"${contract.slug}" anatomy image "${node.part}" requires an imageAssetPath.`);
  }
  const extension = fileExtension(node.imageAssetPath);
  const mimeType = SUPPORTED_IMAGE_ASSET_MIME_TYPES[extension as SupportedImageAssetExtension];
  if (!mimeType) {
    const supported = Object.keys(SUPPORTED_IMAGE_ASSET_MIME_TYPES).join(", ");
    throw new Error(
      `"${contract.slug}" anatomy image "${node.part}" asset "${node.imageAssetPath}" has an ` +
        `unsupported extension "${extension || "(none)"}" — supported: ${supported}.`,
    );
  }
  if (!resolveImageAsset) {
    throw new Error(
      `"${contract.slug}" anatomy image "${node.part}" declares "${node.imageAssetPath}" but no ` +
        "resolveImageAsset was supplied to compile it.",
    );
  }
  const { bytes } = resolveImageAsset(node.imageAssetPath, componentPath);
  if (bytes.length > MAX_EMBEDDED_ASSET_BYTES) {
    throw new Error(
      `"${contract.slug}" anatomy image "${node.part}" asset "${node.imageAssetPath}" is ` +
        `${bytes.length} bytes, exceeding the ${MAX_EMBEDDED_ASSET_BYTES}-byte embedded-asset limit.`,
    );
  }
  return { imageData: encodeBase64(bytes), imageMimeType: mimeType };
}

/**
 * Embeds the SVG of each icon and the data of each image the anatomy references, so the artifact
 * is self-contained. Throws on a missing icon name or unavailable icon.
 */
function embedAnatomyAssets(
  input: CompileGenerationContractInput,
  node: GenerationContractAnatomyNode,
): GenerationContractAnatomyNode {
  const contract = input.contract;
  let iconSvg = node.iconSvg;
  if (node.kind === "icon") {
    if (!node.iconName) {
      throw new Error(`"${contract.slug}" anatomy icon "${node.part}" requires an iconName.`);
    }
    iconSvg = resolveIconSvg(node.iconName) ?? undefined;
    if (!iconSvg) {
      throw new Error(
        `"${contract.slug}" anatomy icon "${node.part}" references unavailable icon "${node.iconName}".`,
      );
    }
  }
  const imageFields =
    node.kind === "image"
      ? embedImageAsset(contract, node, input.componentPath, input.resolveImageAsset)
      : undefined;
  return {
    ...node,
    ...(iconSvg ? { iconSvg } : {}),
    ...(imageFields ?? {}),
    children: node.children?.map((child) => embedAnatomyAssets(input, child)),
  };
}

/** Collects the names of anatomy parts that have no counterpart in the component's CSS. */
function syntheticAnatomyParts(
  node: GenerationContractAnatomyNode | undefined,
  parts = new Set<string>(),
): Set<string> {
  if (!node) return parts;
  if (node.synthetic) parts.add(node.part);
  for (const child of node.children ?? []) syntheticAnatomyParts(child, parts);
  return parts;
}

/**
 * True when NO rule in `cssSource` targeting one of the contract's own declared REAL
 * (non-synthetic) parts declares any paint/text property — parsed via
 * `parseComponentCss` (the same parser the resolver uses), never a hand list of "which
 * components have no paint". A property that's merely unresolvable to a bindable token
 * (e.g. a literal hex `background-color`) still counts as "has paint CSS" — this checks
 * for the DECLARATION's presence, not whether the resolver could bind it.
 */
function stylesheetDeclaresNoOwnPaintOrText(
  contract: FigmaGenerationContract,
  cssSource: string,
): boolean {
  const synthetic = syntheticAnatomyParts(contract.anatomy);
  const realParts = contract.parts.filter((part) => !synthetic.has(part));
  const rules = parseComponentCss(cssSource);
  return !rules.some((rule) => {
    const targetsRealPart = rule.selectors.some((selector) =>
      realParts.some((part) => selector.includes(`[data-ui="${part}"]`)),
    );
    if (!targetsRealPart) return false;
    return rule.declarations.some((decl) => PAINT_OR_TEXT_CSS_PROPERTIES.has(decl.property));
  });
}

export function isComposedOnlyWrapper(
  contract: FigmaGenerationContract,
  cssSource: string,
  knownContractSlugs: ReadonlySet<string> | undefined,
): boolean {
  const hasRequiredKnownComposedChild = (contract.slots ?? []).some(
    (slot) =>
      slot.required && slot.composedChild && knownContractSlugs?.has(slot.composedChild.component),
  );
  if (!hasRequiredKnownComposedChild) return false;
  return stylesheetDeclaresNoOwnPaintOrText(contract, cssSource);
}

/**
 * CSS inheritance: typography declared on a frame reaches text descendants in the browser,
 * but Figma has no inheritance — propagate the nearest ancestor's resolved textStyle to
 * every anatomy text-node part that has no own textStyle binding. Uses a depth-first
 * tree-walk so intermediate sub-parts (e.g. navigation-menu-trigger inside navigation-menu)
 * can serve as the source rather than only the anatomy root.
 *
 * `textCase` (CSS `text-transform`) inherits the same way, so it is flattened by the same walk:
 * a text part's own declaration, `none` (`ORIGINAL`) included, wins over its ancestor's.
 * For `textCase` it also reaches a frame that owns a text slot: both flows draw that slot's
 * text from the frame's own geometry, so the frame must carry the inherited case.
 */
type InheritedTextField = "textStyle" | "textCase";

/**
 * Copies an inherited text style (or text case) down to the parts that inherit it, so each part
 * states its own.
 */
function flattenTextStyleInheritance(
  contract: FigmaGenerationContract,
  resolvedPlan: ResolvedComponentPlan,
  field: InheritedTextField = "textStyle",
): ResolvedComponentPlan {
  if (!contract.anatomy) return resolvedPlan;

  const partBindings: Record<string, ResolvedPlanCell[]> = { ...(resolvedPlan.partBindings ?? {}) };
  let changed = false;

  const ownsTextSlot = (node: GenerationContractAnatomyNode): boolean =>
    node.kind === "frame" &&
    (node.slots ?? []).some((name) => {
      const declared = contract.slots?.find((slot) => slot.name === name);
      return !declared?.composedChild && !declared?.defaultContent;
    });
  const receivesInheritedText = (node: GenerationContractAnatomyNode): boolean =>
    node.kind === "text" || (field === "textCase" && ownsTextSlot(node));

  function walk(
    node: GenerationContractAnatomyNode,
    ancestorTextStyle: ReadonlyArray<ResolvedPlanGeometry[InheritedTextField]>,
  ): void {
    // The textStyle this node passes to its children: own partBinding takes priority,
    // then whatever the nearest ancestor offered.
    const nodeTextStyle = resolvedPlan.variantMatrix.map((_, i) => {
      if (node.part === contract.rootPart) {
        return (
          resolvedPlan.variantMatrix[i]?.geometry?.[field] ?? resolvedPlan.baseGeometry?.[field]
        );
      }
      return partBindings[node.part]?.[i]?.geometry?.[field] ?? ancestorTextStyle[i];
    });

    if (receivesInheritedText(node) && node.part !== contract.rootPart) {
      const existing = partBindings[node.part];
      const cells: ResolvedPlanCell[] = resolvedPlan.variantMatrix.map((cell, i) => {
        const existingCell = existing?.[i] ?? { key: cell.key, label: cell.label, bind: {} };
        if (existingCell.geometry?.[field]) return existingCell;
        const ts = ancestorTextStyle[i];
        if (!ts) return existingCell;
        return {
          ...existingCell,
          geometry: { ...(existingCell.geometry ?? {}), [field]: ts },
        };
      });
      const anyCellChanged = cells.some((c, i) => c !== existing?.[i]);
      if (anyCellChanged) {
        partBindings[node.part] = cells;
        changed = true;
      }
    }

    for (const child of node.children ?? []) walk(child, nodeTextStyle);
  }

  const rootTextStyle = resolvedPlan.variantMatrix.map(
    (cell) => cell.geometry?.[field] ?? resolvedPlan.baseGeometry?.[field],
  );
  walk(contract.anatomy, rootTextStyle);

  if (!changed) return resolvedPlan;
  return { ...resolvedPlan, partBindings };
}

function pruneOrRejectUndeclaredPartBindings(
  contract: FigmaGenerationContract,
  resolvedPlan: ResolvedComponentPlan,
): ResolvedComponentPlan {
  if (!resolvedPlan.partBindings) return resolvedPlan;
  const declared = new Set(contract.parts);
  const omitted = contract.omittedParts ?? {};
  const entries = Object.entries(resolvedPlan.partBindings).filter(([part]) => {
    if (declared.has(part)) return true;
    if (part in omitted) return false;
    // A part-component contract reads a whole component's stylesheet but builds only its own
    // part; the other parts are that component's, not omissions to justify.
    if (contract.source) return false;
    throw new Error(
      `"${contract.slug}" has a CSS-resolvable sub-part "${part}" that is neither declared in ` +
        `\`parts\` nor listed in \`omittedParts\` with a reason. Either add it to the anatomy, or ` +
        `add \`omittedParts["${part}"] = "<reason>"\` if it cannot be honestly represented.`,
    );
  });
  if (entries.length === Object.keys(resolvedPlan.partBindings).length) return resolvedPlan;
  return { ...resolvedPlan, partBindings: Object.fromEntries(entries) };
}

/** The human reason of an `omittedParts` entry, whether a plain string or a classified object. */
function omittedReason(entry: string | ClassifiedOmittedPart | undefined): string {
  return typeof entry === "string" ? entry : (entry?.reason ?? "");
}

/** Own declarations of `property` on rules targeting `[data-ui="part"]` (any selector/state). */
function partDeclarationValues(part: string, cssSource: string, property: string): string[] {
  return parseComponentCss(cssSource)
    .filter((rule) => rule.selectors.some((selector) => selector.includes(`[data-ui="${part}"]`)))
    .flatMap((rule) => rule.declarations)
    .filter((decl) => decl.property === property)
    .map((decl) => decl.value.trim());
}

/** True when a rule in `cssSource` targeting `[data-ui="part"]` declares any property in `props`. */
function partHasOwnDeclaration(
  part: string,
  cssSource: string,
  props: ReadonlySet<string>,
): boolean {
  const rules = parseComponentCss(cssSource);
  return rules.some((rule) => {
    const targetsPart = rule.selectors.some((selector) => selector.includes(`[data-ui="${part}"]`));
    if (!targetsPart) return false;
    return rule.declarations.some((decl) => props.has(decl.property));
  });
}

/**
 * The subset of `PAINT_OR_TEXT_CSS_PROPERTIES` that paints a part's BOX rather than its text
 * content — background/border/shadow (and `outline`, which components in this repo routinely use
 * as a resting border, not only a focus ring). Deliberately excludes `color`, `font-family`,
 * `font-size`, `font-weight`, `line-height`: a part with only those is a piece of colored TEXT
 * (a label, a caption), not a container a designer would recognise as "the field" or "the popup".
 * This is a property-category split, never a per-component/per-part name list.
 */
const SURFACE_PAINT_PROPERTIES: ReadonlySet<string> = new Set([
  "background",
  "background-color",
  "border",
  "border-color",
  "outline",
  "outline-color",
  "box-shadow",
]);

function rejectUnpaintedWrapperMissingPaintedSurface(
  contract: FigmaGenerationContract,
  resolvedPlan: ResolvedComponentPlan,
  cssSource: string,
): void {
  const hasAnyPaintAnywhere = resolvedPlan.parts.some((part) =>
    partHasOwnDeclaration(part, cssSource, PAINT_OR_TEXT_CSS_PROPERTIES),
  );
  if (!hasAnyPaintAnywhere) return;
  const surfaceParts = resolvedPlan.parts.filter((part) =>
    partHasOwnDeclaration(part, cssSource, SURFACE_PAINT_PROPERTIES),
  );
  if (surfaceParts.length === 0) return;
  if (partHasOwnDeclaration(contract.rootPart, cssSource, SURFACE_PAINT_PROPERTIES)) return;
  const declared = new Set(contract.parts);
  if (surfaceParts.some((part) => declared.has(part))) return;
  const omittedParts = contract.omittedParts ?? {};
  const missing = surfaceParts.map((part) =>
    part in omittedParts
      ? `${part} (omitted: "${omittedReason(omittedParts[part])}")`
      : `${part} (undeclared)`,
  );
  throw new Error(
    `"${contract.slug}" anatomy root "${contract.rootPart}" is an unpainted structural wrapper, ` +
      `and every part that carries surface paint (background/border/shadow) is absent from its ` +
      `anatomy: ${missing.join(", ")}. Model the styled interactive surface (the field or ` +
      `popup/list) instead of omitting all of it.`,
  );
}

/**
 * True when the part's own CSS declares a surface-paint property with a value that actually
 * paints: `outline: none`, `border: none` and `background: transparent` reset a surface, they do
 * not draw one, so a part with only those (e.g. `autocomplete-trigger`) is not a painted surface.
 */
function partPaintsSurface(part: string, cssSource: string): boolean {
  const NON_PAINTING = new Set(["none", "transparent", "0", "initial", "unset", "inherit"]);
  return [...SURFACE_PAINT_PROPERTIES].some((property) =>
    partDeclarationValues(part, cssSource, property).some((value) => !NON_PAINTING.has(value)),
  );
}

function validateOmittedSurfaceParts(
  contract: FigmaGenerationContract,
  resolvedPlan: ResolvedComponentPlan,
  cssSource: string,
): void {
  const omitted = contract.omittedParts ?? {};
  for (const [part, entry] of Object.entries(omitted)) {
    if (!resolvedPlan.parts.includes(part)) continue;
    if (!partPaintsSurface(part, cssSource)) continue;
    const where = `"${contract.slug}" omittedParts["${part}"]`;
    if (typeof entry === "string") {
      throw new Error(
        `${where}: "${part}" carries surface paint (background/border/shadow), so its omission ` +
          `needs a classified reason \`{ kind: ${OMITTED_PART_KINDS.map((k) => `"${k}"`).join(" | ")}, ` +
          `reason }\`, not a plain string. An interactive field or popup surface cannot be omitted.`,
      );
    }
    const positions = partDeclarationValues(part, cssSource, "position");
    if (entry.kind === "window-relative" && !positions.includes("fixed")) {
      throw new Error(
        `${where} is classified window-relative, but "${part}" does not declare \`position: fixed\` ` +
          `in its CSS. Only a window-anchored scrim fits this kind; model the surface instead.`,
      );
    }
    if (
      entry.kind === "runtime-position" &&
      !positions.some((value) => ["absolute", "fixed", "sticky"].includes(value))
    ) {
      throw new Error(
        `${where} is classified runtime-position, but "${part}" declares no ` +
          `\`position: absolute | fixed | sticky\` in its CSS. An in-flow surface is not ` +
          `runtime-placed; model the surface instead.`,
      );
    }
    if (entry.kind === "unrepresentable-state") {
      if (!entry.via || entry.via === part || !(entry.via in omitted)) {
        throw new Error(
          `${where} is classified unrepresentable-state, so it must name in \`via\` another ` +
            `part in omittedParts that "${part}" is only reachable through.`,
        );
      }
    }
  }
}

function validateIconSlots(
  contract: FigmaGenerationContract,
  node: GenerationContractAnatomyNode,
  declaredSlots: ReadonlyMap<string, GenerationContractSlot>,
): void {
  if (node.kind !== "icon") return;
  if ((node.slots ?? []).some((slotName) => declaredSlots.has(slotName))) return;
  // An instance-swap property is the icon's own swap point, so it needs no slot.
  if (
    (contract.properties ?? []).some(
      (property) => property.type === "instanceSwap" && property.part === node.part,
    )
  ) {
    return;
  }
  throw new Error(
    `"${contract.slug}" anatomy icon "${node.part}" is not covered by a declared slot ` +
      `(every icon part is a slot or an instance-swap property). Add \`{ name: "<name>", part: ` +
      `"${node.part}" }\` to the contract's \`slots\` and \`slots: ["<name>"]\` to this anatomy node.`,
  );
}

/**
 * Throws when the anatomy tree is inconsistent with the contract and the resolved plan, for
 * example an unknown part or a missing documentation source.
 */
function validateAnatomy(
  contract: FigmaGenerationContract,
  resolved: CompiledGenerationContract["resolvedPlan"],
  verifyDocsSource?: (docsFilePath: string) => boolean,
): void {
  const anatomy = contract.anatomy;
  if (!anatomy) return;
  if (anatomy.part !== contract.rootPart) {
    throw new Error(
      `"${contract.slug}" anatomy root "${anatomy.part}" does not match root part "${contract.rootPart}".`,
    );
  }

  const declaredSlots = new Map((contract.slots ?? []).map((slot) => [slot.name, slot]));
  const materializedSlots = new Set<string>();
  const materializedParts = new Set<string>();
  const blockParts = buildingBlockParts(contract);

  function visit(node: GenerationContractAnatomyNode): void {
    if (!contract.parts.includes(node.part)) {
      throw new Error(`"${contract.slug}" anatomy references undeclared part "${node.part}".`);
    }
    if (materializedParts.has(node.part)) {
      throw new Error(`"${contract.slug}" anatomy materializes part "${node.part}" twice.`);
    }
    materializedParts.add(node.part);
    if (node.repeat !== undefined && (!Number.isInteger(node.repeat) || node.repeat < 1)) {
      throw new Error(
        `"${contract.slug}" anatomy part "${node.part}" has an invalid repeat count.`,
      );
    }
    if (node.repeat !== undefined && node.items !== undefined) {
      throw new Error(
        `"${contract.slug}" anatomy part "${node.part}" cannot use repeat and items.`,
      );
    }
    if (node.layoutByAxis) {
      const axis = contract.axes.find(({ prop }) => prop === node.layoutByAxis?.axis);
      if (!axis) {
        throw new Error(
          `"${contract.slug}" anatomy part "${node.part}" has an unknown layout axis.`,
        );
      }
      for (const value of Object.keys(node.layoutByAxis.values)) {
        if (!axis.values.includes(value)) {
          throw new Error(
            `"${contract.slug}" anatomy part "${node.part}" has an unknown layout value "${value}".`,
          );
        }
      }
    }
    // A part a Building Block owns may also read the block's own axes, which the parent lacks.
    const blockAxes = (contract.buildingBlocks ?? [])
      .filter((block) => blockParts.get(block.part)?.has(node.part))
      .flatMap((block) => block.axes);
    const axisFor = (axis: string) =>
      contract.axes.find((candidate) => candidate.prop === axis) ??
      blockAxes.find((candidate) => candidate.prop === axis);
    for (const [axis, value] of Object.entries(node.when ?? {})) {
      const knownAxis = axisFor(axis);
      const values = Array.isArray(value) ? value : [value];
      const unknown = values.find((v) => !knownAxis?.values?.includes(v));
      if (unknown !== undefined) {
        throw new Error(
          `"${contract.slug}" anatomy part "${node.part}" has unknown ${axis} value "${unknown}".`,
        );
      }
    }
    for (const [axis, value] of Object.entries(node.unless ?? {})) {
      const knownAxis = axisFor(axis);
      const values = Array.isArray(value) ? value : [value];
      const unknown = values.find((v) => !knownAxis?.values?.includes(v));
      if (unknown !== undefined) {
        throw new Error(
          `"${contract.slug}" anatomy part "${node.part}" has unknown excluded ${axis} value "${unknown}".`,
        );
      }
    }
    for (const slotName of node.slots ?? []) {
      const slot = declaredSlots.get(slotName);
      if (!slot) {
        throw new Error(`"${contract.slug}" anatomy references undeclared slot "${slotName}".`);
      }
      if (slot.part !== node.part) {
        throw new Error(
          `"${contract.slug}" anatomy slot "${slotName}" is attached to "${node.part}" instead of "${slot.part}".`,
        );
      }
      if (materializedSlots.has(slotName)) {
        throw new Error(`"${contract.slug}" anatomy materializes slot "${slotName}" twice.`);
      }
      materializedSlots.add(slotName);
    }
    validateIconSlots(contract, node, declaredSlots);
    const positionSlot = slotNameOf(node.positionAlongMain);
    if (positionSlot !== undefined && !declaredSlots.has(positionSlot)) {
      throw new Error(
        `"${contract.slug}" anatomy part "${node.part}" positionAlongMain references undeclared slot "${positionSlot}".`,
      );
    }
    const sizeSlot = slotNameOf(node.sizeAlongMain);
    if (sizeSlot !== undefined && !declaredSlots.has(sizeSlot)) {
      throw new Error(
        `"${contract.slug}" anatomy part "${node.part}" sizeAlongMain references undeclared slot "${sizeSlot}".`,
      );
    }
    if (node.positionAlongMainByAxis) {
      const axis = contract.axes.find(({ prop }) => prop === node.positionAlongMainByAxis?.axis);
      if (!axis) {
        throw new Error(
          `"${contract.slug}" anatomy part "${node.part}" has an unknown positionAlongMainByAxis axis.`,
        );
      }
      for (const [value, declared] of Object.entries(node.positionAlongMainByAxis.values)) {
        if (!axis.values.includes(value)) {
          throw new Error(
            `"${contract.slug}" anatomy part "${node.part}" has an unknown positionAlongMainByAxis value "${value}".`,
          );
        }
        const slot = slotNameOf(declared);
        if (slot !== undefined && !declaredSlots.has(slot)) {
          throw new Error(
            `"${contract.slug}" anatomy part "${node.part}" positionAlongMainByAxis["${value}"] references undeclared slot "${slot}".`,
          );
        }
      }
    }
    if (node.overlayCrossAlignByAxis) {
      const axis = contract.axes.find(({ prop }) => prop === node.overlayCrossAlignByAxis?.axis);
      if (!axis) {
        throw new Error(
          `"${contract.slug}" anatomy part "${node.part}" has an unknown overlayCrossAlignByAxis axis.`,
        );
      }
      for (const value of Object.keys(node.overlayCrossAlignByAxis.values)) {
        if (!axis.values.includes(value)) {
          throw new Error(
            `"${contract.slug}" anatomy part "${node.part}" has an unknown overlayCrossAlignByAxis value "${value}".`,
          );
        }
      }
    }
    if (node.removeFromFlowByAxis) {
      const axis = contract.axes.find(({ prop }) => prop === node.removeFromFlowByAxis?.axis);
      if (!axis) {
        throw new Error(
          `"${contract.slug}" anatomy part "${node.part}" has an unknown removeFromFlowByAxis axis.`,
        );
      }
      for (const value of Object.keys(node.removeFromFlowByAxis.values)) {
        if (!axis.values.includes(value)) {
          throw new Error(
            `"${contract.slug}" anatomy part "${node.part}" has an unknown removeFromFlowByAxis value "${value}".`,
          );
        }
      }
    }
    const hasPositioning =
      node.removeFromFlow !== undefined ||
      node.removeFromFlowByAxis !== undefined ||
      node.positionAlongMain !== undefined ||
      node.positionAlongMainByAxis !== undefined ||
      node.sizeAlongMain !== undefined;
    if (hasPositioning) {
      if (node.part === contract.rootPart) {
        const isRootRefusalOnly =
          node.removeFromFlow === undefined &&
          node.removeFromFlowByAxis === undefined &&
          node.positionAlongMainByAxis === undefined &&
          node.sizeAlongMain === undefined &&
          node.positionAlongMain?.kind === "refused";
        if (!isRootRefusalOnly) {
          throw new Error(
            `"${contract.slug}" anatomy root "${node.part}" cannot declare removeFromFlow/positionAlongMain/sizeAlongMain — it has no parent, except a root-level positionAlongMain: { kind: "refused" }.`,
          );
        }
      }
      if (!node.reason?.trim()) {
        throw new Error(
          `"${contract.slug}" anatomy part "${node.part}" must have a non-empty reason whenever removeFromFlow, positionAlongMain, or sizeAlongMain is declared.`,
        );
      }
    }
    validateDocsLayout(node, contract.slug, verifyDocsSource);
    for (const item of node.items ?? []) {
      // An item of a Building Block's node picks the block's variant, so it may name block axes.
      for (const [axis, value] of Object.entries(item.key ?? {})) {
        const knownAxis = axisFor(axis);
        if (!knownAxis?.values?.includes(value)) {
          throw new Error(
            `"${contract.slug}" anatomy item for "${node.part}" has unknown ${axis} value "${value}".`,
          );
        }
      }
      for (const slotName of Object.keys(item.slots ?? {})) {
        if (!declaredSlots.has(slotName)) {
          throw new Error(
            `"${contract.slug}" anatomy item for "${node.part}" provides undeclared slot "${slotName}".`,
          );
        }
      }
    }
    const visibleCells = resolved.variantMatrix
      .map((cell, index) => ({ cell, index }))
      .filter(
        ({ cell }) =>
          matchesCondition(cell.key, node.when) &&
          !(node.unless && matchesCondition(cell.key, node.unless)),
      );
    for (const role of node.requiredBindings ?? []) {
      for (const { cell, index } of visibleCells) {
        const isRoot = node.part === contract.rootPart;
        const partCell = isRoot ? undefined : resolved.partBindings?.[node.part]?.[index];
        const bind = (isRoot ? cell.bind : partCell?.bind) as Record<string, unknown> | undefined;
        const geometry = (isRoot ? cell.geometry : partCell?.geometry) as
          | Record<string, unknown>
          | undefined;
        const value = resolveRole(
          role,
          bind,
          geometry,
          resolved.baseGeometry as Record<string, unknown>,
        );
        if (!value) {
          throw new Error(
            `"${contract.slug}" anatomy part "${node.part}" requires a CSS-derived ${role} binding.`,
          );
        }
      }
    }
    for (const child of node.children ?? []) visit(child);
  }

  visit(anatomy);
  for (const part of contract.parts) {
    if (part === contract.viewport?.backdropPart) continue;
    if (!materializedParts.has(part)) {
      throw new Error(`"${contract.slug}" anatomy does not materialize part "${part}".`);
    }
  }
  for (const slot of contract.slots ?? []) {
    if (!materializedSlots.has(slot.name)) {
      throw new Error(`"${contract.slug}" anatomy does not materialize slot "${slot.name}".`);
    }
  }
}

/**
 * The 0-based repeat count of the anatomy node that declares `slotName` in its
 * `slots` — ToggleGroup's synthetic `toggle-group-item` wrapper declares both
 * `repeat: 3` and `slots: ["item"]` on the SAME node, so this is a plain
 * depth-first search, not a separate "which node owns this slot" index.
 * Defaults to `1` (no repeat) when the slot isn't found on a repeating node —
 * that's every composed-child slot that isn't ToggleGroup's today (Field's
 * `control`, Fieldset's children, …), each rendered exactly once.
 */
function findSlotRepeatCount(
  node: GenerationContractAnatomyNode | undefined,
  slotName: string,
): number {
  if (!node) return 1;
  if (node.slots?.includes(slotName)) return node.repeat ?? 1;
  for (const child of node.children ?? []) {
    const found = findSlotRepeatCount(child, slotName);
    if (found !== 1) return found;
  }
  return 1;
}

/**
 * A `currentColor` stroke (`ResolvedPlanBinding.strokeFromText`) follows the text colour the part
 * inherits, but a component set generated on its own has no surrounding control to inherit from
 * (Spinner's `tone="current"` arc). For a variant cell where some part strokes in `currentColor`
 * and nothing in the cell resolves a text colour, bind the documentation theme's body text role,
 * the same ink the documentation preview paints its own text in, on the cell's root so every part
 * inherits it. A cell that already resolves a text colour (Spinner's brand tone) is untouched, and
 * so is every component with no `currentColor` stroke.
 */
export function applyDocumentationTextFallback(
  components: CompiledGenerationContract[],
  themeText: string,
): void {
  const plans = components.flatMap((component) => [
    component.resolvedPlan,
    ...(component.buildingBlocks ?? []).map((block) => block.resolvedPlan),
  ]);
  for (const resolvedPlan of plans) {
    const parts = Object.values(resolvedPlan.partBindings ?? {});
    resolvedPlan.variantMatrix.forEach((cell, index) => {
      if (cell.bind.text !== undefined) return;
      const cells = parts.map((matrix) => matrix[index]?.bind);
      // The root's own stroke follows the root's text colour, which a part's text cannot supply.
      if (cell.bind.strokeFromText === true) {
        cell.bind.text = themeText;
        return;
      }
      const strokesInCurrentColor = cells.some((bind) => bind?.strokeFromText);
      const resolvesText = cells.some((bind) => bind?.text !== undefined);
      if (strokesInCurrentColor && !resolvesText) cell.bind.text = themeText;
    });
  }
}

function attachComposedChildOverrides(
  components: CompiledGenerationContract[],
  inputsBySlug: ReadonlyMap<string, CompileGenerationContractInput>,
): void {
  const contractsBySlug = new Map(components.map((c) => [c.contract.slug, c.contract]));
  for (const component of components) {
    const { contract, resolvedPlan } = component;
    for (const slot of contract.slots ?? []) {
      if (!slot.composedChild) continue;
      const childContract = contractsBySlug.get(slot.composedChild.component);
      const parentInput = inputsBySlug.get(contract.slug);
      if (!childContract || !parentInput) continue; // Composition validation already refused an unknown reference.

      const parentEntry = extractComponentRegistry({
        name: contract.componentName,
        tsxSource: parentInput.tsxSource,
        sourcePath: parentInput.sourcePath,
        cssSource: parentInput.cssSource,
        componentPath: parentInput.componentPath,
        stylesheetPath: parentInput.stylesheetPath,
        rootPart: contract.rootPart,
      });
      const repeatCount = findSlotRepeatCount(contract.anatomy, slot.name);
      const { cells, refusedDescendantOverrides } = resolveComposedChildOverrides(
        parentEntry,
        childContract.rootPart,
        repeatCount,
        contract.axes,
      );

      if (cells.length > 0) {
        resolvedPlan.composedChildOverrides = {
          ...resolvedPlan.composedChildOverrides,
          [slot.name]: fillComposedChildInsets(contract, resolvedPlan, slot.part, cells),
        };
      }
      if (refusedDescendantOverrides.size > 0) {
        resolvedPlan.refusedDescendantOverrides = { ...resolvedPlan.refusedDescendantOverrides };
        for (const [fragment, reason] of refusedDescendantOverrides) {
          resolvedPlan.refusedDescendantOverrides[fragment] = reason;
        }
      }
    }
  }
}

function validateLayoutAgainstCss(
  contract: FigmaGenerationContract,
  plan: ResolvedComponentPlan,
): void {
  type Conditions = Array<Pick<GenerationContractAnatomyNode, "when" | "unless">>;
  const visit = (node: GenerationContractAnatomyNode, inherited: Conditions): void => {
    // A node renders only in the cells its own and every ancestor's `when`/`unless` allow.
    const conditions = [...inherited, { when: node.when, unless: node.unless }];
    const rendered = plan.variantMatrix
      .map((variant, index) => ({ variant, index }))
      .filter(({ variant }) =>
        conditions.every(
          ({ when, unless }) =>
            matchesCondition(variant.key, when) &&
            !(unless && matchesCondition(variant.key, unless)),
        ),
      );
    const cells =
      node.part === contract.rootPart ? plan.variantMatrix : plan.partBindings?.[node.part];
    if (
      node.kind === "frame" &&
      (node.layout || node.layoutByAxis) &&
      cells?.length === plan.variantMatrix.length &&
      rendered.length > 0 &&
      rendered.every(({ index }) => cells[index].geometry?.layoutMode)
    ) {
      rendered.forEach(({ variant, index }) => {
        const stated = resolveByAxis(node.layoutByAxis, node.layout, variant.key);
        const css = cells[index].geometry?.layoutMode === "VERTICAL" ? "vertical" : "horizontal";
        if (stated && stated !== "overlay" && stated !== css) {
          throw new Error(
            `"${contract.slug}" anatomy node "${node.part}" declares layout "${stated}", but its CSS flex-direction gives "${css}" for ${JSON.stringify(variant.key)}. Omit layout to use the CSS direction.`,
          );
        }
      });
    }
    for (const child of node.children ?? []) visit(child, conditions);
  };
  if (contract.anatomy) visit(contract.anatomy, []);
}

/** The axes the component's own source declares (its local `data-*`-driving union types). */
function sourceAxesOf(input: CompileGenerationContractInput): ComponentRegistryAxis[] {
  if (input.sourceAxes) return input.sourceAxes;
  return extractComponentRegistry({
    name: input.contract.componentName,
    tsxSource: input.tsxSource,
    sourcePath: input.sourcePath,
    cssSource: input.cssSource,
    componentPath: input.componentPath,
    stylesheetPath: input.stylesheetPath,
    rootPart: input.contract.rootPart,
  }).axes;
}

/**
 * Compiles one authored contract with its component's source into a validated contract and
 * resolved plan. Throws when the contract is incomplete or contradicts the source.
 */
export function compileGenerationContract(
  input: CompileGenerationContractInput,
): CompiledGenerationContract {
  // Axes first (D25): every source axis the contract leaves out is filled in from the component's
  // own union types, so everything below sees the full axes. `buildGenerationContractArtifact`
  // has already done this for a batch; a normalized contract comes back unchanged.
  const withAxes = normalizeContractAxes(input.contract, sourceAxesOf(input));
  // The viewport rules name a missing or wrong context axis more precisely than an example key
  // that uses it would, so they run before the keys are checked.
  assertAuthoredViewport(withAxes);
  const normalized = normalizeExampleKeys(withAxes);
  const authored = normalized.anatomy
    ? {
        ...normalized,
        anatomy: embedAnatomyAssets(input, normalized.anatomy),
      }
    : normalized;
  // A declared focus ring becomes its part, anatomy node and boolean property, and its metrics are
  // read from the root's `:focus-visible` outline (the resolver answers the colours below).
  const expanded = expandFocusRing(authored);
  // The ring layer shows focus, so a State value for it would show it twice.
  const focusValue = expanded.focusRing
    ? expanded.axes.find((axis) =>
        Object.values(axis.valueSelectors ?? {}).some((selector) =>
          selector?.includes(":focus-visible"),
        ),
      )
    : undefined;
  if (focusValue) {
    throw new Error(
      `"${expanded.slug}" declares a focus ring and axis "${focusValue.prop}" has a \`:focus-visible\` value; the ring layer shows focus, so remove the value.`,
    );
  }
  const ringMetrics = expanded.focusRing
    ? readFocusRingMetrics(expanded, input.cssSource)
    : undefined;
  // The ring's inset, the same for every variant or per value of the one axis it follows.
  const ringPlacement = ringMetrics ? focusRingPlacement(expanded, ringMetrics) : {};
  const contract = expanded.focusRing
    ? { ...expanded, focusRing: { ...expanded.focusRing, ...ringPlacement } }
    : expanded;
  requireTheme(input.documentationTheme);
  if (!contract.documentation.examples.length) {
    throw new Error(`"${contract.slug}" requires at least one documentation example.`);
  }
  requiresCompleteDocumentation(contract);
  validateSlots(contract);
  const propertyRefusals = propertyErrors(contract);
  if (propertyRefusals.length > 0) throw new Error(propertyRefusals[0]);
  const setRefusals = componentSetErrors(contract);
  if (setRefusals.length > 0) throw new Error(setRefusals[0]);
  const runtimeErrors = runtimeValueErrors(contract);
  if (runtimeErrors.length > 0) throw new Error(runtimeErrors[0]);
  const pseudoParts = pseudoPartsFromContract(contract);
  const documentedDisplayAxes = contract.axes.filter((axis) => axis.valueSelectors);
  if (
    contract.anatomy &&
    documentedDisplayAxes.length > 0 &&
    (!contract.reactToFigmaNotes?.length ||
      contract.reactToFigmaNotes.some((note) => note.trim().length === 0))
  ) {
    throw new Error(`"${contract.slug}" design-only axes require non-empty reactToFigmaNotes.`);
  }
  const planInput = {
    name: contract.componentName,
    tsxSource: input.tsxSource,
    sourcePath: input.sourcePath,
    cssSource: input.cssSource,
    componentPath: input.componentPath,
    stylesheetPath: input.stylesheetPath,
    rootPart: contract.rootPart,
    layoutManifest: input.layoutManifest,
  };
  const sourcePlan = resolvedPlanFromComponentSource({
    ...planInput,
    axes: contract.axes,
    pseudoParts,
    anatomy: contract.anatomy
      ? {
          root: contract.anatomy,
          modelled: contract.parts,
          omitted: Object.keys(contract.omittedParts ?? {}),
        }
      : undefined,
  });
  const resolvedPlan = ringMetrics
    ? withFocusRingBindings(
        contract,
        sourcePlan,
        resolvedPlanFromComponentSource({
          ...planInput,
          axes: focusRingAxes(contract.axes) as typeof contract.axes,
        }),
        ringMetrics,
        (key) => resolveByAxis(ringPlacement.insetPxByAxis, ringPlacement.insetPx, key),
      )
    : sourcePlan;
  if (!sameAxes(contract, resolvedPlan)) {
    throw new Error(`"${contract.slug}" contract axes do not match its source/CSS resolution.`);
  }
  for (const { part } of pseudoParts) {
    const reason = resolvedPlan.refusedPseudoParts?.[part];
    if (reason) {
      throw refusal(
        "pseudo-part-refused",
        `"${contract.slug}" pseudo part "${part}" is refused, not resolvable: ${reason} ` +
          "Remove it from parts/anatomy rather than declaring an unresolvable pseudo element.",
        diagnosticPath(contract.slug, ["parts", part]),
      );
    }
  }
  const syntheticParts = syntheticAnatomyParts(contract.anatomy);
  for (const part of contract.parts) {
    if (syntheticParts.has(part)) continue;
    if (!resolvedPlan.parts.includes(part)) {
      throw new Error(`"${contract.slug}" contract part "${part}" is absent from source.`);
    }
  }
  for (const [part, entry] of Object.entries(contract.omittedParts ?? {})) {
    if (!omittedReason(entry).trim()) {
      throw new Error(`"${contract.slug}" omittedParts["${part}"] must have a non-empty reason.`);
    }
    if (typeof entry !== "string" && !OMITTED_PART_KINDS.includes(entry.kind)) {
      throw new Error(
        `"${contract.slug}" omittedParts["${part}"] has an unknown kind "${String(entry.kind)}"; ` +
          `use one of ${OMITTED_PART_KINDS.join(", ")}.`,
      );
    }
    if (contract.parts.includes(part)) {
      throw new Error(
        `"${contract.slug}" omittedParts["${part}"] is also declared in parts — a part is either declared or omitted, never both.`,
      );
    }
    if (!resolvedPlan.parts.includes(part)) {
      throw new Error(`"${contract.slug}" omittedParts["${part}"] is absent from source.`);
    }
  }
  rejectUnpaintedWrapperMissingPaintedSurface(contract, resolvedPlan, input.cssSource);
  validateOmittedSurfaceParts(contract, resolvedPlan, input.cssSource);
  const flattenedPlan = pruneOrRejectUndeclaredPartBindings(
    contract,
    mapMarginsToLayout(
      contract,
      flattenTextStyleInheritance(
        contract,
        flattenTextStyleInheritance(contract, resolvedPlan),
        "textCase",
      ),
    ),
  );
  validateAnatomy(contract, flattenedPlan, input.verifyDocsSource);
  validateLayoutAgainstCss(contract, flattenedPlan);
  const { viewport, plan: viewportPlan } = compileViewport({
    contract,
    plan: flattenedPlan,
    sourcePlan: resolvedPlan,
    cssSource: input.cssSource,
  });
  for (const example of contract.documentation.examples) {
    if (!flattenedPlan.variantMatrix.some((cell) => sameKey(cell.key, example.key))) {
      throw new Error(
        `"${contract.slug}" example "${example.label}" does not match a resolved variant.`,
      );
    }
  }
  validateLiteralGeometry(contract, contract.literalGeometry, flattenedPlan);
  const partMatrices = Object.values(flattenedPlan.partBindings ?? {});
  const hasNoOwnBinding = (cell: ResolvedPlanCell, index: number) =>
    !cell.bind.fill &&
    !cell.bind.text &&
    !cell.bind.stroke &&
    !cell.bind.effectStyle &&
    !cell.geometry?.textStyle &&
    !flattenedPlan.baseGeometry.textStyle &&
    !partMatrices.some((matrix) => {
      const partCell = matrix[index];
      return (
        partCell?.bind.fill ||
        partCell?.bind.text ||
        partCell?.bind.stroke ||
        partCell?.bind.effectStyle ||
        partCell?.geometry?.textStyle
      );
    });
  if (
    flattenedPlan.variantMatrix.some((cell, index) => hasNoOwnBinding(cell, index)) &&
    !isComposedOnlyWrapper(contract, input.cssSource, input.knownContractSlugs)
  ) {
    throw new Error(`"${contract.slug}" has a variant with no CSS-derived bindings.`);
  }
  // Each Building Block is compiled as a contract of its own, from the same stylesheet, over its
  // own axes only (none come from the component's source).
  const buildingBlocks: CompiledBuildingBlock[] = (contract.buildingBlocks ?? []).map((block) => {
    const compiled = compileGenerationContract({
      ...input,
      contract: buildingBlockContract(contract, block),
      sourceAxes: [],
    });
    return { part: block.part, contract: compiled.contract, resolvedPlan: compiled.resolvedPlan };
  });
  return {
    contract: viewport ? { ...contract, viewport } : contract,
    resolvedPlan: declareRuntimeDimensions(
      contract,
      mapLayoutIntents(
        contract,
        mapAlignSelfToParent(contract, applyColumnStretch(contract, viewportPlan, input.cssSource)),
        input.cssSource,
      ),
    ),
    ...(buildingBlocks.length > 0 ? { buildingBlocks } : {}),
  };
}

function declareRuntimeDimensions(
  contract: FigmaGenerationContract,
  plan: ResolvedComponentPlan,
): ResolvedComponentPlan {
  const declarations = (contract.runtimeValues ?? []).filter(({ replaces }) => replaces.length > 0);
  if (declarations.length === 0) return plan;
  const partBindings = { ...(plan.partBindings ?? {}) };
  for (const declaration of declarations) {
    const cells = partBindings[declaration.part];
    const matched = new Set<string>();
    const declare = (dimension: ResolvedDimension | undefined): ResolvedDimension | undefined => {
      if (!dimension) return dimension;
      const property = declaration.replaces.find((candidate) =>
        dimension.kind === "unsupported"
          ? new RegExp(`^var\\(\\s*${candidate}\\s*\\)$`).test(dimension.value.trim())
          : dimension.kind === "variable" &&
            dimension.variable === cssVarToFigmaVariableName(candidate),
      );
      if (!property) return dimension;
      matched.add(property);
      return { kind: "runtime", property };
    };
    partBindings[declaration.part] = (cells ?? []).map((cell) =>
      cell.geometry
        ? {
            ...cell,
            geometry: {
              ...cell.geometry,
              width: declare(cell.geometry.width),
              height: declare(cell.geometry.height),
            },
          }
        : cell,
    );
    for (const property of declaration.replaces) {
      if (!matched.has(property)) {
        throw new Error(
          `"${contract.slug}" runtime value "${declaration.name}" replaces "${property}", but "${declaration.part}"'s CSS never sizes with it.`,
        );
      }
    }
  }
  return { ...plan, partBindings };
}

/**
 * Compiles a batch of authored contracts into one artifact, checking the shared documentation
 * theme, unique slugs and composed children. Throws on any inconsistency.
 */
export function buildGenerationContractArtifact(
  authoredInputs: CompileGenerationContractInput[],
  documentationPage?: DocumentationPage,
): GenerationContractArtifact {
  if (!authoredInputs.length)
    throw new Error("Generation contract artifact requires at least one component.");
  const documentationTheme = authoredInputs[0].documentationTheme;
  for (const input of authoredInputs) {
    if (!sameTheme(input.documentationTheme, documentationTheme)) {
      throw new Error(
        `"${input.contract.slug}" uses a different documentation theme than the artifact theme.`,
      );
    }
  }
  const slugs = new Set<string>();
  for (const input of authoredInputs) {
    if (slugs.has(input.contract.slug)) {
      throw new Error(`Duplicate generation contract slug "${input.contract.slug}".`);
    }
    slugs.add(input.contract.slug);
  }
  const normalized = normalizeComposedChildKeys(
    authoredInputs.map((input) => normalizeContractAxes(input.contract, sourceAxesOf(input))),
  );
  const inputs = authoredInputs.map((input, index) => ({ ...input, contract: normalized[index] }));
  validateComposition(inputs.map((input) => input.contract));
  const components = inputs
    .map((input) => compileGenerationContract({ ...input, knownContractSlugs: slugs }))
    .sort((a, b) => compareCodepoints(a.contract.slug, b.contract.slug));
  attachComposedChildOverrides(
    components,
    new Map(inputs.map((input) => [input.contract.slug, input])),
  );
  applyDocumentationTextFallback(components, documentationTheme.text);
  return {
    artifact: "focus.figma-generation-contract",
    version: GENERATION_CONTRACT_ARTIFACT_SCHEMA_VERSION,
    documentationTheme,
    ...(documentationPage && Object.keys(documentationPage).length > 0
      ? { documentationPage }
      : {}),
    components,
  };
}
