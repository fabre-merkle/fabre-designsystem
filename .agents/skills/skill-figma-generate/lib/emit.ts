/**
 * The emitter reference. Walks a `ComponentPlan` /
 * `DocKitPlan` and creates the Figma nodes via the Plugin API. This is the ONLY
 * impure layer — it touches `figma.*`, so it is type-checked against
 * `@figma/plugin-typings` but not unit-tested (the deterministic decisions live
 * in `emit-core.ts`, which IS tested). The primitives are ported from Kumo's
 * `packages/kumo-figma/shared.ts`: bind variables BY NAME
 * (separator-stripped, camelCase-aware) instead of a fixed `kumo-colors`
 * collection, and no Tailwind→px table (geometry is `var(--token)` refs
 * that map 1:1 to same-named variables).
 *
 * USAGE — the agent inlines this file into a single `use_figma` script. Load the
 * `figma-use` skill first and follow its script rules: plain top-level `await`, and
 * `return` the result (node IDs and the run-state lists) as the output. Do not call
 * `figma.closePlugin()` or wrap the script in an async function; the runtime does both.
 *
 * The plan is produced by `generateComponentPlan` (pure)
 * and passed in as data; nothing here re-derives design — only node IDs vary
 * between runs.
 */
/// <reference types="@figma/plugin-typings" />
import { type AnatomyNodePlan, type AnatomySlotPlan, type ComposedChildRef, composedChildRequestKey, type ResolvedPositionAlongMain, type ResolvedSizeAlongMain } from "./anatomy";
import type { ComposedChildOverrideBinding, ResolvedCell } from "./artifact";
import { type DocumentationChromeBindings, type DocumentationPagePlan, type DocumentationPagePlanNode, withoutMissingIcons } from "./documentation-page";
import { decodeBase64, decodeUtf8, indexVariablesByName, normalizeVarName, type ReconcilePlan, resolveBinding, resolveTextStyleName } from "./emit-core";
import type { AxisSizing, CellGeometryPlan } from "./geometry";
import { type HealableStyle, planStyleHeals } from "./heal";
import type { ComponentBody, ComponentPlan, ComponentPropertyPlan } from "./plan";
import type { ViewportFramePlan } from "./viewport";

// Raw font family used only when a variant cell / part label can't inherit a DS
// text style (the chrome roles bind DS text styles by name; these interior
// component labels are per-archetype and fall back to the DS default family).
// Mirrors `buildTextStyleIndex().defaultFamily`'s own "Inter" fallback.
const FONT_FAMILY_FALLBACK = "Inter";

// ---------- Variable resolution (bind by name across the whole file) ----------

/** Index every local variable by normalised name, once, so binds are O(1). */
export function buildVariableIndex(): {
  byNorm: Map<string, string>;
  varByName: Map<string, Variable>;
} {
  const varByName = new Map<string, Variable>();
  for (const v of figma.variables.getLocalVariables()) varByName.set(v.name, v);
  return { byNorm: indexVariablesByName([...varByName.keys()]), varByName };
}

type VarIndex = ReturnType<typeof buildVariableIndex>;

function variableFor(token: string, index: VarIndex): Variable | null {
  const match = resolveBinding(token, index.byNorm);
  return match.variable ? (index.varByName.get(match.variable) ?? null) : null;
}

// ---------- Kumo-ported primitives (adapted to bind-by-name) ----------

export interface AutoLayout {
  mode: "HORIZONTAL" | "VERTICAL";
  primaryAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
  counterAxisAlignItems?: "MIN" | "CENTER" | "MAX";
  padding?: number | { top: number; right: number; bottom: number; left: number };
  itemSpacing?: number;
  primaryAxisSizingMode?: "FIXED" | "AUTO";
  counterAxisSizingMode?: "FIXED" | "AUTO";
}

export function createAutoLayoutFrame(name: string, cfg: AutoLayout): FrameNode {
  const frame = figma.createFrame();
  frame.name = name;
  // Transparent by default. Figma frames are born with an opaque white fill; on a
  // themed (esp. dark-default) doc page that white shows THROUGH every un-themed
  // chrome frame (header, columns, rows), and the DS `onSurface` text bound on top
  // resolves to the ambient (dark) mode → light text on white → invisible. Chrome
  // frames must be transparent so the root's themed surface shows through; the few
  // frames that need a surface (root, mode panels) bind one explicitly afterwards.
  frame.fills = [];
  frame.layoutMode = cfg.mode;
  if (cfg.primaryAxisAlignItems) frame.primaryAxisAlignItems = cfg.primaryAxisAlignItems;
  if (cfg.counterAxisAlignItems) frame.counterAxisAlignItems = cfg.counterAxisAlignItems;
  if (cfg.padding !== undefined) {
    const p = typeof cfg.padding === "number" ? { top: cfg.padding, right: cfg.padding, bottom: cfg.padding, left: cfg.padding } : cfg.padding;
    frame.paddingTop = p.top;
    frame.paddingRight = p.right;
    frame.paddingBottom = p.bottom;
    frame.paddingLeft = p.left;
  }
  if (cfg.itemSpacing !== undefined) frame.itemSpacing = cfg.itemSpacing;
  // hug by default (re-asserted after any resize, which flips these to FIXED).
  frame.primaryAxisSizingMode = cfg.primaryAxisSizingMode ?? "AUTO";
  frame.counterAxisSizingMode = cfg.counterAxisSizingMode ?? "AUTO";
  return frame;
}

/**
 * Assigns a paint to a node and keeps its opacity. Figma resets a variable-bound paint's opacity to
 * 1 when the paint is first assigned to a node, and keeps it when the bound paint is assigned
 * again, so a paint with an opacity is assigned twice.
 */
function setPaint(node: SceneNode, field: "fills" | "strokes", paint: SolidPaint): void {
  const target = node as unknown as Record<"fills" | "strokes", ReadonlyArray<Paint>>;
  target[field] = [paint];
  if (paint.opacity === undefined || paint.opacity === 1) return;
  target[field] = target[field].map((assigned) => ({ ...assigned, opacity: paint.opacity }));
}

/**
 * Creates an instance of a component and keeps its paints' opacity. A new instance takes its
 * component's variable-bound paints at opacity 1, so each node whose paints carry an opacity has
 * them assigned again on the instance, which keeps it.
 */
export function createInstanceOf(component: ComponentNode): InstanceNode {
  const instance = component.createInstance();
  restorePaintOpacity(component, instance);
  return instance;
}

function restorePaintOpacity(source: BaseNode, target: BaseNode): void {
  for (const field of ["fills", "strokes"] as const) {
    if (!(field in source) || !(field in target)) continue;
    const paints = (source as unknown as Record<typeof field, unknown>)[field];
    if (!Array.isArray(paints)) continue;
    if (!paints.some((paint: Paint) => paint.opacity !== undefined && paint.opacity !== 1)) continue;
    (target as unknown as Record<typeof field, ReadonlyArray<Paint>>)[field] = paints;
  }
  if (!("children" in source) || !("children" in target)) return;
  const sourceChildren = source.children;
  const targetChildren = target.children;
  if (sourceChildren.length !== targetChildren.length) return;
  for (const [index, child] of sourceChildren.entries()) {
    restorePaintOpacity(child, targetChildren[index]!);
  }
}

/** Bind a node's fill to a variable by token name; raw mid-grey fallback when absent. */
export function bindFill(node: SceneNode & { fills: ReadonlyArray<Paint> | symbol }, token: string, index: VarIndex, opacity?: number): boolean {
  const variable = variableFor(token, index);
  let paint: SolidPaint = { type: "SOLID", color: { r: 0.5, g: 0.5, b: 0.5 } };
  // The strength the CSS mixes the colour with `transparent` at is the paint's own opacity.
  if (opacity !== undefined) paint = { ...paint, opacity };
  if (variable) paint = figma.variables.setBoundVariableForPaint(paint, "color", variable);
  setPaint(node, "fills", paint);
  return !!variable;
}

export function bindStroke(node: SceneNode & MinimalStrokesMixin, token: string, index: VarIndex, weight = 1, opacity?: number): boolean {
  const variable = variableFor(token, index);
  let paint: SolidPaint = { type: "SOLID", color: { r: 0.5, g: 0.5, b: 0.5 } };
  if (opacity !== undefined) paint = { ...paint, opacity };
  if (variable) paint = figma.variables.setBoundVariableForPaint(paint, "color", variable);
  setPaint(node, "strokes", paint);
  node.strokeWeight = weight;
  if ("strokeAlign" in node) (node as { strokeAlign: string }).strokeAlign = "INSIDE";
  return !!variable;
}

export function bindTextColor(node: TextNode, token: string, index: VarIndex): boolean {
  const variable = variableFor(token, index);
  let paint: SolidPaint = { type: "SOLID", color: { r: 0, g: 0, b: 0 } };
  if (variable) paint = figma.variables.setBoundVariableForPaint(paint, "color", variable);
  node.fills = [paint];
  return !!variable;
}

/**
 * Create a text node, loading the font BEFORE setting characters (Plugin API rule). `fontSize`
 * is optional: an anatomy text is sized by its text style or bound typography, never a literal.
 */
export async function createText(characters: string, family: string, style: string, fontSize?: number): Promise<TextNode> {
  await figma.loadFontAsync({ family, style });
  const t = figma.createText();
  t.fontName = { family, style };
  t.characters = characters;
  if (fontSize !== undefined) t.fontSize = fontSize;
  t.textAutoResize = "WIDTH_AND_HEIGHT";
  return t;
}

// ---------- Documentation chrome (closed `documentationTheme` roles -> project variables / text styles) ----------
//
// The documentation page is the plan's `documentation.plan` (documentation-page.ts, a mirror of the
// plugin's page plan). Every visual choice in it is a ROLE from the artifact's closed
// `documentationTheme` vocabulary; this file only resolves a role to the project's own variable
// (spacing, colour, radius) or text style by name. There is no literal spacing, font, size or colour
// here: a role the file cannot resolve throws, exactly like the plugin, instead of falling back to
// an invented value. Chrome is plain nodes on the component's OWN page (cross-page instancing
// silently no-ops on the `use_figma` bridge, see SKILL.md "Driving use_figma reliably").

/**
 * DS text styles by name → id (built ONCE per run, like the variable index). `defaultFamily` is a
 * DS-derived fallback font for the rare case a role's typography token has no matching style.
 * Lookup goes through `resolveTextStyleName`, which maps a typography tier to the composite style
 * the token sync published for it.
 */
export async function buildTextStyleIndex(): Promise<{ names: ReadonlySet<string>; idByName: Map<string, string>; defaultFamily: string }> {
  const styles = await figma.getLocalTextStylesAsync();
  const idByName = new Map<string, string>();
  for (const s of styles) idByName.set(s.name, s.id);
  const defaultFamily = styles[0]?.fontName.family ?? "Inter";
  return { names: new Set(idByName.keys()), idByName, defaultFamily };
}
type TextStyleIndex = Awaited<ReturnType<typeof buildTextStyleIndex>>;

function textStyleFor(token: string, index: TextStyleIndex): string | null {
  const match = resolveTextStyleName(token, index.names);
  return match.kind === "found" ? (index.idByName.get(match.name) ?? null) : null;
}

/**
 * Load the font a text style carries, so applying that style leaves the node writable.
 * `setTextStyleIdAsync` re-fonts the node; Figma then rejects every further write to it
 * (`characters`, `fontSize`, `textCase`, …) with "Cannot write to node with unloaded font"
 * unless that font is already loaded. Call this BEFORE applying any DS text style.
 */
async function loadTextStyleFont(styleId: string): Promise<void> {
  const style = await figma.getStyleByIdAsync(styleId);
  if (style?.type === "TEXT") await figma.loadFontAsync(style.fontName);
}

/**
 * Heal local text styles BEFORE any component is generated (see `heal.ts`).
 *
 * Tokens Studio (and any pipeline that maps a `%` line-height token to a Figma
 * variable) imports line-height as a bound FLOAT ratio — and a bound FLOAT
 * line-height renders as PIXELS (`1.5px`), collapsing every line of text (most
 * visibly the doc header). This is NOT optional cleanup: without it the very
 * first render is broken. `renderComponentPlan` calls this once, guarded by a
 * module flag so it runs a single time per inlined script even when the emitter
 * loops over many components. Idempotent — re-running finds nothing left to heal.
 */
let _healedThisRun = false;
export async function applyStyleHeals(force = false): Promise<{ healed: string[] }> {
  if (_healedThisRun && !force) return { healed: [] };
  _healedThisRun = true;
  const styles = await figma.getLocalTextStylesAsync();
  const view: HealableStyle[] = styles.map((s) => ({
    name: s.name,
    lineHeight: s.lineHeight as HealableStyle["lineHeight"],
    boundVariables: s.boundVariables?.lineHeight
      ? { lineHeight: { id: (s.boundVariables.lineHeight as VariableAlias).id } }
      : null,
  }));
  const healed: string[] = [];
  for (const action of planStyleHeals(view)) {
    const style = styles.find((s) => s.name === action.style);
    if (!style) continue;
    await figma.loadFontAsync(style.fontName);
    for (const field of action.patch.unbind ?? []) style.setBoundVariable(field, null);
    if (action.patch.set?.lineHeight) style.lineHeight = action.patch.set.lineHeight as LineHeight;
    healed.push(action.style);
  }
  return { healed };
}

function chromeVariable(token: string, ctx: RenderContext): Variable | null {
  return ctx.index.varByName.get(token) ?? variableFor(token, ctx.index);
}

function bindChromePaint(node: GeometryMixin, property: "fills" | "strokes", token: string, ctx: RenderContext): void {
  const variable = chromeVariable(token, ctx);
  if (!variable) return;
  node[property] = [figma.variables.setBoundVariableForPaint({ type: "SOLID", color: { r: 0, g: 0, b: 0 } }, "color", variable)];
}

function bindChromeSpacing(
  node: FrameNode,
  property: "itemSpacing" | "paddingTop" | "paddingRight" | "paddingBottom" | "paddingLeft",
  token: string,
  ctx: RenderContext,
): void {
  const variable = chromeVariable(token, ctx);
  if (!variable) throw new Error(`Documentation chrome spacing role requires local variable "${token}".`);
  node.setBoundVariable(property, variable);
}

async function createChromeLabel(
  node: Extract<DocumentationPagePlanNode, { kind: "label" }>,
  chrome: DocumentationChromeBindings,
  ctx: RenderContext,
): Promise<TextNode> {
  const token = chrome[node.style];
  const styleId = textStyleFor(token, ctx.textStyles);
  if (!styleId) throw new Error(`Documentation chrome text-style role "${node.style}" requires local text style "${token}".`);
  await loadTextStyleFont(styleId);
  const text = figma.createText();
  await text.setTextStyleIdAsync(styleId);
  text.characters = node.content;
  const tone = chrome[node.tone ?? "text"];
  if (!chromeVariable(tone, ctx)) throw new Error(`Documentation chrome text role "${node.tone ?? "text"}" requires local variable "${tone}".`);
  bindChromePaint(text, "fills", tone, ctx);
  // A real hyperlink, so the docs link is clickable from the canvas.
  if (node.href) text.setRangeHyperlink(0, node.content.length, { type: "URL", value: node.href });
  return text;
}

/** Section rule: a line stroked with the `divider` role, stretched to the parent's width. */
function createChromeDivider(chrome: DocumentationChromeBindings, ctx: RenderContext): LineNode {
  if (!chromeVariable(chrome.divider, ctx)) throw new Error(`Documentation chrome divider role requires local variable "${chrome.divider}".`);
  const line = figma.createLine();
  line.name = "Divider";
  bindChromePaint(line, "strokes", chrome.divider, ctx);
  line.layoutAlign = "STRETCH";
  return line;
}

/** Pin a panel to one theme mode of the file's theme collection; a mode the file lacks leaves it ambient. */
function applyThemeMode(frame: FrameNode, collection: VariableCollection | undefined, modeName: string): void {
  if (!collection) return;
  const mode = collection.modes.find((candidate) => candidate.name.toLowerCase() === modeName.toLowerCase());
  if (mode) frame.setExplicitVariableModeForCollection(collection, mode.modeId);
}

/** The pieces a documentation page embeds: the master sets and their variant COMPONENTs by full label. */
interface DocumentationParts {
  /** The component's first set: the one a definition without a set name means. */
  componentSet: GeneratedSetNode;
  /** Every set of the component by name (a split contract has several). */
  sets: Map<string, GeneratedSetNode>;
  /** Every Building Block set by its Figma name (a split block has one per split value). */
  blocks: Map<string, GeneratedSetNode>;
  variantsByName: Map<string, ComponentNode>;
  /** The popup component (or set) a viewport set instances; shown above it as the Code Connect target. */
  popup?: ComponentNode | ComponentSetNode;
  /** The placeholder icon components an instance swap defaults to, by icon name. */
  icons: Map<string, ComponentNode>;
}

async function renderDocumentationNode(
  node: DocumentationPagePlanNode,
  chrome: DocumentationChromeBindings,
  parts: DocumentationParts,
  ctx: RenderContext,
): Promise<SceneNode> {
  if (node.kind === "label") return createChromeLabel(node, chrome, ctx);
  if (node.kind === "divider") return createChromeDivider(chrome, ctx);
  if (node.kind === "variant-instance") {
    const variant = parts.variantsByName.get(node.label);
    if (!variant) throw new Error(`Documentation preview variant "${node.label}" is missing.`);
    return createInstanceOf(variant);
  }
  if (node.kind === "component-definition") {
    if (node.set === undefined) return parts.componentSet;
    const set = parts.sets.get(node.set);
    if (!set) throw new Error(`Documentation set definition "${node.set}" is missing.`);
    return set;
  }
  if (node.kind === "building-block-definition") {
    const block = parts.blocks.get(node.name);
    if (!block) throw new Error(`Documentation Building Block definition "${node.part}" is missing.`);
    return block;
  }
  if (node.kind === "popup-definition") {
    if (!parts.popup) throw new Error("Documentation popup definition is missing.");
    return parts.popup;
  }
  if (node.kind === "icon-definition") {
    const icon = parts.icons.get(node.icon);
    if (!icon) throw new Error(`Documentation placeholder icon "${node.icon}" is missing.`);
    return icon;
  }

  const stack = createAutoLayoutFrame(node.name, { mode: node.direction });
  bindChromeSpacing(stack, "itemSpacing", chrome[node.gap], ctx);
  if (node.padding) {
    for (const property of ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"] as const) {
      bindChromeSpacing(stack, property, chrome[node.padding], ctx);
    }
  }
  if (node.surface) {
    const fill = chrome[node.surface];
    if (!chromeVariable(fill, ctx)) throw new Error(`Documentation chrome surface role "${node.surface}" requires local variable "${fill}".`);
    bindChromePaint(stack, "fills", fill, ctx);
  }
  if (node.divider) {
    if (!chromeVariable(chrome.divider, ctx)) throw new Error(`Documentation chrome divider role requires local variable "${chrome.divider}".`);
    bindChromePaint(stack, "strokes", chrome.divider, ctx);
  }
  if (node.rounded) {
    const radius = chromeVariable(chrome.radius, ctx);
    if (radius) stack.setBoundVariable("cornerRadius", radius);
  }
  applyThemeMode(stack, ctx.themeCollection, node.themeMode ?? "");
  for (const child of node.children) stack.appendChild(await renderDocumentationNode(child, chrome, parts, ctx));
  return stack;
}

/**
 * Render the documentation page onto `page`: the page shell, then the master component set in its
 * own captioned frame BESIDE it (outside the shell's auto-layout flow, so it cannot disturb it).
 * Mirrors the plugin's `renderDocumentationPage`.
 */
async function renderDocumentationPage(
  documentation: ComponentPlan["documentation"],
  parts: DocumentationParts,
  page: PageNode,
  ctx: RenderContext,
): Promise<void> {
  const pagePlan: DocumentationPagePlan = documentation.plan;
  const shell = await renderDocumentationNode(pagePlan.root, documentation.chrome, parts, ctx);
  if (shell.type !== "FRAME") throw new Error("Documentation page root must be a frame.");
  shell.x = 80;
  shell.y = 80;
  page.appendChild(shell);

  const definition = await renderDocumentationNode(
    withoutMissingIcons(pagePlan.definition, new Set(parts.icons.keys())),
    documentation.chrome,
    parts,
    ctx,
  );
  page.appendChild(definition);
  // The offset is the page's own bound gutter, read back rather than written as a literal.
  const gutter = Number.isFinite(shell.paddingLeft) ? shell.paddingLeft : 0;
  definition.x = shell.x + shell.width + gutter;
  definition.y = shell.y;
}

// ---------- Variant grid (generic, plan-driven) ----------

/** Bind all four corner radii to a token (Plugin API binds per-corner). */
function bindAllRadii(node: ComponentNode | FrameNode, token: string, index: VarIndex): void {
  const v = variableFor(token, index);
  if (!v) return;
  for (const corner of ["topLeftRadius", "topRightRadius", "bottomLeftRadius", "bottomRightRadius"] as const) {
    node.setBoundVariable(corner, v);
  }
}

// ---------- Cell box ----------

/**
 * Direction + alignment. No hardcoded `CENTER`: the artifact's CSS-derived
 * alignment applies, else Figma's own default (`MIN`). `overlay` is `NONE` — a
 * positioned, not flowed, frame that must not clip children that escape it.
 */
function applyCellLayout(comp: ComponentNode, box: CellGeometryPlan): void {
  comp.layoutMode = box.layoutMode;
  comp.counterAxisAlignItems = box.counterAxisAlignItems;
  comp.primaryAxisAlignItems = box.primaryAxisAlignItems;
  comp.primaryAxisSizingMode = "AUTO";
  comp.counterAxisSizingMode = "AUTO";
  if (box.layoutMode === "NONE") comp.clipsContent = false;
}

/**
 * Set `layoutSizingHorizontal`/`Vertical`, reporting whether it took. Figma throws
 * on a node that isn't in an auto-layout parent rather than ignoring the write, so
 * every call site treats it as fallible.
 */
function setLayoutSizing(node: SceneNode, layoutAxis: "layoutSizingHorizontal" | "layoutSizingVertical", value: "FIXED" | "FILL" | "HUG"): boolean {
  if (!(layoutAxis in node)) return false;
  try {
    (node as unknown as Record<string, string>)[layoutAxis] = value;
    return true;
  } catch {
    return false;
  }
}

/**
 * Give a root the width its content would hug to, after `width: 100%` was refused.
 *
 * A refused FILL leaves the node hugging, which is harmless on its own. It is NOT
 * harmless when the whole subtree below it also says FILL, down to the text: then
 * nothing in the box declares a width, and Figma collapses the root to its 10px
 * minimum — the variant renders as an unreadable sliver (Accordion did exactly
 * this). Measure instead of guessing: flip every FILL descendant to HUG, read the
 * width the real content wants, put every node back as it was, and pin the root
 * there. Nothing is invented and no descendant's sizing changes.
 */
function fitRefusedFillWidth(comp: SceneNode & LayoutMixin): void {
  const frame = comp as unknown as FrameNode;
  if (!("children" in frame) || frame.layoutMode === "NONE") return;
  const restore: Array<() => void> = [];
  const visit = (node: SceneNode): void => {
    if (node.type === "TEXT" && node.textAutoResize === "HEIGHT") {
      node.textAutoResize = "WIDTH_AND_HEIGHT";
      restore.push(() => {
        node.textAutoResize = "HEIGHT";
      });
    }
    const sizing = node as unknown as { layoutSizingHorizontal?: string };
    if (sizing.layoutSizingHorizontal === "FILL" && setLayoutSizing(node, "layoutSizingHorizontal", "HUG")) {
      restore.push(() => {
        setLayoutSizing(node, "layoutSizingHorizontal", "FILL");
      });
    }
    if ("children" in node) for (const child of node.children) visit(child);
  };
  for (const child of frame.children) visit(child);
  if (!restore.length) return; // nothing was filling: the hug box is already honest
  const width = frame.width;
  for (const undo of restore.reverse()) undo();
  if (!isFigmaLength(width)) return;
  // `resize` is ignored while the axis hugs, and `layoutSizing*` throws on a root,
  // so the axis is pinned through the sizing mode that owns the width here.
  if (frame.layoutMode === "VERTICAL") frame.counterAxisSizingMode = "FIXED";
  else frame.primaryAxisSizingMode = "FIXED";
  frame.resize(width, frame.height);
}

/**
 * Apply one axis's sizing decision. Order matters twice over: an explicit size is
 * SILENTLY IGNORED while the axis is `AUTO` (so a applied size sets the axis FIXED
 * first), and `layoutSizing*` is only writable under an auto-layout parent. A
 * refusal is REPORTED and nothing is applied — never an approximated size.
 */
function applyAxisSizing(
  comp: SceneNode & LayoutMixin,
  axis: "width" | "height",
  sizing: AxisSizing | undefined,
  label: string,
  ctx: RenderContext,
): void {
  if (!sizing) return; // `hug` (or nothing declared): leave auto-layout alone
  const layoutAxis = axis === "width" ? "layoutSizingHorizontal" : "layoutSizingVertical";
  if (sizing.mode === "runtime") {
    // a fraction of the parent's FINAL box, applied by
    // `applyDeferredRemoveFromFlow` — the only place the plugin applies one.
    return;
  }
  if (sizing.mode === "refused") {
    ctx.refusedSizes.push(`${label} ${axis}: ${sizing.value}`);
    return;
  }
  if (sizing.mode === "fill") {
    if (!setLayoutSizing(comp, layoutAxis, "FILL")) {
      // Only legal for a child of an auto-layout frame; a root keeps its own size.
      ctx.refusedSizes.push(`${label} ${axis}: 100% outside an auto-layout parent`);
      if (axis === "width") fitRefusedFillWidth(comp);
      return;
    }
    // A text node that fills the width must wrap and grow downward; Figma's default for new text
    // (WIDTH_AND_HEIGHT) would keep it one line long whatever its width says.
    if (axis === "width" && comp.type === "TEXT") comp.textAutoResize = "HEIGHT";
    return;
  }
  // Best-effort: `layoutSizing*` throws outside an auto-layout parent (a root, or an
  // overlay frame), where `resize()`/a bound size applies directly anyway.
  // Checked before the axis is locked FIXED, so a refused size leaves the node's sizing as it was.
  if (sizing.mode === "fixed" && !isFigmaLength(sizing.px)) {
    ctx.refusedSizes.push(`${label} ${axis}: unusable length (${sizing.px})`);
    return;
  }
  setLayoutSizing(comp, layoutAxis, "FIXED");
  if (sizing.mode === "fixed") {
    comp.resize(axis === "width" ? sizing.px : comp.width, axis === "height" ? sizing.px : comp.height);
    return;
  }
  const variable = ctx.index.varByName.get(sizing.variable) ?? variableFor(sizing.variable, ctx.index);
  if (variable) comp.setBoundVariable(axis, variable);
  else ctx.unresolvedSizes.push(sizing.variable); // a CSS length can name a non-token: non-blocking
}

/**
 * The box, in the plugin's order: declared literal size, then per-axis sizing
 * (which wins per axis), then `aspect-ratio` as a post-sizing reshape of whatever
 * the sizing just produced (Figma has no `aspect-ratio`; the height is a REAL
 * number by then, never a guessed literal).
 */
function applyCellBox(comp: ComponentNode, box: CellGeometryPlan, ctx: RenderContext): void {
  const literal = box.literalSize;
  if (literal) {
    // Same contract as `applyLiteralSize`: each axis must be a finite length >= 0.01;
    // a refused axis is reported and the usable one still applies.
    const usable = (axis: "width" | "height", px: number | undefined): px is number => {
      if (px === undefined) return false;
      if (isFigmaLength(px)) return true;
      ctx.refusedSizes.push(`${box.label} ${axis}: unusable length (${px})`);
      return false;
    };
    const width = usable("width", literal.width) ? literal.width : undefined;
    const height = usable("height", literal.height) ? literal.height : undefined;
    if (width !== undefined || height !== undefined) comp.resize(width ?? comp.width, height ?? comp.height);
  }
  applyAxisSizing(comp, "width", box.sizing.width, box.label, ctx);
  applyAxisSizing(comp, "height", box.sizing.height, box.label, ctx);
  // The CSS width cap of a bare popup: it hugs, up to this width.
  if (box.maxWidthPx !== undefined) comp.maxWidth = box.maxWidthPx;
  if (box.aspectRatio) {
    const height = comp.height;
    if (!(height > 0)) {
      ctx.refusedSizes.push(`${box.label} aspectRatio: unusable height (${height})`);
      return;
    }
    const width = height * box.aspectRatio;
    if (!isFigmaLength(width)) {
      ctx.refusedSizes.push(`${box.label} aspectRatio: unusable width (${width})`);
      return;
    }
    comp.resize(width, height);
    setLayoutSizing(comp, "layoutSizingHorizontal", "FIXED");
  }
}

// ---------- Anatomy tree (nested parts · native slots · composed children) ----------
//
// Mirrors the plugin walker's `materializeAnatomyNode` / `appendAnatomyText` /
// `configureNativeSlot` / `appendMaybeSlotted`:
// the plan (`AnatomyNodePlan`, from `anatomy.ts`) says WHAT; this only carries it out.
// Anything it cannot carry out is reported on the `RenderContext`, never approximated.

/** Probed once per component and shared by every variant (the plugin does the same). */
export interface SlotCapability {
  probed: boolean;
  available: boolean;
}

/** One variant's anatomy walk state. Native slots are created on the variant's ROOT component. */
interface AnatomyRun {
  root: ComponentNode;
  capability: SlotCapability;
  ctx: RenderContext;
  /** Overlay children awaiting cross-axis placement — the parent's box is final only after the root is sized. */
  deferredOverlay: Array<{
    child: SceneNode;
    parent: FrameNode | ComponentNode;
    align: NonNullable<AnatomyNodePlan["overlayCrossAlign"]>;
    label: string;
    mainAxis?: "width" | "height";
    positionAlongMain?: ResolvedPositionAlongMain;
    sizeAlongMain?: ResolvedSizeAlongMain;
  }>;
  /** removeFromFlow children of an auto-layout parent, placed once the parent's box is final. */
  deferredRemoveFromFlow: DeferredRemoveFromFlow[];
  /** Children of an overlay frame positioned by percentage insets, placed once the parent's box is final. */
  deferredInsetPlacement: Array<{
    child: SceneNode;
    parent: BaseNode & ChildrenMixin;
    constraints: NonNullable<AnatomyNodePlan["geometry"]["constraints"]>;
    insetPercent: NonNullable<AnatomyNodePlan["geometry"]["insetPercent"]>;
    label: string;
  }>;
  /** `100%` on a child of an overlay frame: stretched once the parent's box is final. */
  deferredAbsoluteFill: Array<{
    child: SceneNode;
    parent: BaseNode & ChildrenMixin;
    axis: "width" | "height";
    label: string;
  }>;
  /** Focus ring layers awaiting the root's final box, which they are placed outside of. */
  deferredFocusRings: DeferredFocusRing[];
  /** Set inside a native slot's default content: Figma does not nest a slot in a slot, so slots there are plain content. */
  suppressSlots?: boolean;
  /** Component-property bindings and icon components, shared by every cell of the set. */
  properties?: PropertyResources;
}

/**
 * Namespace for the emitter's own node metadata. SHARED plugin data, not private
 * plugin data: `setPluginData` / `getPluginData` are private-plugin-only and are
 * rejected outright by several hosts — including the Figma MCP `use_figma` runtime
 * ("figma.setPluginData is not supported in this host runtime"). Shared plugin data
 * works everywhere and across plugins. Namespace rules: >= 3 chars, alphanumeric/_/.
 */
const SHARED_DATA_NAMESPACE = "focus.generated";
/** Shared-data key stamped on a private icon component an instance swap defaults to. */
const ICON_COMPONENT_KEY = "icon";
/** `__icon/<name>`: the icon component's name, used to recover its key where metadata is unavailable. */
const ICON_COMPONENT_NAME_PREFIX = "__icon/";

/** One node a component property is wired to once the set exists. */
interface PropertyBinding {
  node: SceneNode;
  /** Property names by the node field they drive. */
  references: { characters?: string; visible?: string; mainComponent?: string };
  /** What `visible` is before the property takes over. */
  visibleDefault?: boolean;
}

/**
 * What the cells of one set share for component properties: the nodes to wire, and the private
 * icon components an instance swap defaults to (one per icon, reused by every cell), created in
 * `parent` beside the set.
 */
interface PropertyResources {
  parent: BaseNode & ChildrenMixin;
  bindings: PropertyBinding[];
  icons: Map<string, ComponentNode>;
}

/**
 * The private component an instance-swap property defaults to, made once per icon from the icon's
 * own SVG (the same import every other icon uses) and reused. Null when the SVG cannot be imported.
 */
function ensureIconComponent(
  resources: PropertyResources,
  iconName: string,
  svg: string,
  /** The icon's size where it is first used, so the definition is not the SVG's own 256px grid. */
  size: { width: number; height: number },
): ComponentNode | null {
  const cached = resources.icons.get(iconName);
  if (cached) return cached;
  const frame = createIconFrame(svg);
  if (!frame) return null;
  // The paths carry SCALE constraints, so they scale with the frame.
  if (size.width >= 0.01 && size.height >= 0.01) frame.resize(size.width, size.height);
  const component = figma.createComponent();
  component.name = `${ICON_COMPONENT_NAME_PREFIX}${iconName}`;
  component.fills = [];
  component.resize(frame.width, frame.height);
  for (const child of [...frame.children]) component.appendChild(child);
  frame.remove();
  component.setSharedPluginData(SHARED_DATA_NAMESPACE, ICON_COMPONENT_KEY, iconName);
  resources.parent.appendChild(component);
  resources.icons.set(iconName, component);
  return component;
}

/**
 * The icon key an icon component was generated under. Reads the shared plugin data the
 * emitter wrote, and falls back to the component's own `__icon/<name>` name so a host that
 * refuses node metadata still resolves the documentation page's icon definitions.
 */
function iconComponentKey(icon: ComponentNode): string {
  let stored = "";
  try {
    stored = icon.getSharedPluginData(SHARED_DATA_NAMESPACE, ICON_COMPONENT_KEY);
  } catch {
    stored = "";
  }
  return stored || icon.name.slice(ICON_COMPONENT_NAME_PREFIX.length);
}

/**
 * Adds the declared properties to the set (never to a cell), keeps each returned key (Figma
 * appends an id to the name), and wires every recorded node to its keys. A boolean node takes its
 * default visibility first. A swap whose icon failed to import is not created: the failed icon is
 * already reported by part, as a visible placeholder.
 */
function applyComponentProperties(set: ComponentSetNode, plans: readonly ComponentPropertyPlan[], resources: PropertyResources): void {
  const keys = new Map<string, string>();
  for (const plan of plans) {
    if (plan.type === "text") {
      keys.set(plan.name, set.addComponentProperty(plan.name, "TEXT", plan.default));
    } else if (plan.type === "boolean") {
      keys.set(plan.name, set.addComponentProperty(plan.name, "BOOLEAN", plan.default));
    } else {
      const icon = resources.icons.get(plan.iconName);
      if (icon) keys.set(plan.name, set.addComponentProperty(plan.name, "INSTANCE_SWAP", icon.id));
    }
  }
  for (const { node, references, visibleDefault } of resources.bindings) {
    const wired: Record<string, string> = {};
    for (const [field, name] of Object.entries(references)) {
      const key = keys.get(name);
      if (key) wired[field] = key;
    }
    if (Object.keys(wired).length === 0) continue;
    if (wired.visible && visibleDefault !== undefined) node.visible = visibleDefault;
    node.componentPropertyReferences = wired;
  }
}

/**
 * Place the private icon components on the page, to the right of everything else, stacked: they
 * are definitions, not designs, so they sit clear of the set and its documentation.
 */
function placeIconComponents(page: PageNode, icons: readonly ComponentNode[]): void {
  if (icons.length === 0) return;
  const others = page.children.filter((child) => !icons.includes(child as ComponentNode));
  const x = Math.max(80, ...others.map((child) => child.x + child.width + 80));
  const gutter = 24;
  let y = 80;
  for (const icon of icons) {
    icon.x = x;
    icon.y = y;
    y += icon.height + gutter;
  }
}

/**
 * a `removeFromFlow` child awaiting `layoutPositioning = "ABSOLUTE"`, its declared
 * lengths and anchors, then `constraints`. `crossAlign` is the node's `overlayCrossAlign`.
 * `runtimeSize` is its declared runtime sizes per PHYSICAL axis, as a fraction of the parent's
 * length on that axis (Tabs' `--active-tab-width` horizontally).
 */
interface DeferredRemoveFromFlow {
  child: SceneNode;
  parent: BaseNode & ChildrenMixin;
  positionAlongMain?: ResolvedPositionAlongMain;
  sizeAlongMain?: ResolvedSizeAlongMain;
  crossAlign?: NonNullable<AnatomyNodePlan["overlayCrossAlign"]>;
  runtimeSize?: { width?: number; height?: number };
  label: string;
}

/** A focus ring layer awaiting the box of the root it surrounds. */
interface DeferredFocusRing {
  child: SceneNode;
  parent: BaseNode & ChildrenMixin;
  /** How far the ring's outer edge sits outside the parent, in pixels. */
  insetPx: number;
  label: string;
}

/** Takes a focus ring out of its auto-layout root's flow; `false` when the root has none. */
function takeFocusRingOutOfFlow(child: SceneNode, parent: BaseNode & ChildrenMixin): boolean {
  if (!("layoutMode" in parent) || !("layoutPositioning" in child)) return false;
  const layoutMode = (parent as BaseFrameMixin).layoutMode;
  if (layoutMode !== "HORIZONTAL" && layoutMode !== "VERTICAL") return false;
  (child as SceneNode & AutoLayoutChildrenMixin).layoutPositioning = "ABSOLUTE";
  return true;
}

/**
 * Places each focus ring outside the root it surrounds and keeps it there, as the plugin does: out
 * of the root's flow, stretched on both axes with its outer edge `insetPx` outside the root (so the
 * ring follows an instance that resizes), unfilled, and the root stops clipping so the ring shows.
 * Its stroke width and colour are bound like any part's.
 */
function applyDeferredFocusRings(run: AnatomyRun): void {
  for (const { child, parent, insetPx, label } of run.deferredFocusRings) {
    if (!("resize" in child) || !("layoutMode" in parent)) {
      run.ctx.refusedSizes.push(`${label} focus ring: the node cannot be placed outside its parent`);
      continue;
    }
    const box = parent as unknown as { width: number; height: number };
    if ("clipsContent" in parent) (parent as FrameNode).clipsContent = false;
    const layoutMode = (parent as BaseFrameMixin).layoutMode;
    if ((layoutMode === "HORIZONTAL" || layoutMode === "VERTICAL") && !takeFocusRingOutOfFlow(child, parent)) {
      run.ctx.refusedSizes.push(`${label} focus ring: node does not support layoutPositioning`);
      continue;
    }
    if ("fills" in child) (child as GeometryMixin).fills = [];
    child.x = -insetPx;
    child.y = -insetPx;
    (child as FrameNode).resize(box.width + insetPx * 2, box.height + insetPx * 2);
    if ("constraints" in child) (child as ConstraintMixin).constraints = { horizontal: "STRETCH", vertical: "STRETCH" };
  }
}

/** The text node of `part` inside an instance (its own, not a nested instance's): named for the part, or its content. */
function namedTextNode(node: BaseNode & ChildrenMixin, part: string): TextNode | undefined {
  for (const child of node.children) {
    if (child.type === "TEXT" && (child.name === part || child.name === `${part} content`)) return child;
    if (child.type === "INSTANCE" || !("children" in child)) continue;
    const found = namedTextNode(child, part);
    if (found) return found;
  }
  return undefined;
}

/**
 * Sets one text slot's copy on a Building Block instance: through the block's text property when
 * the part has one, else on the text node named for the part. With one slot and no such node the
 * instance's own text takes it, as a composed child's does.
 */
async function setBlockInstanceText(
  instance: InstanceNode,
  entry: { part: string; text: string; property?: string },
  only: boolean,
  block: string,
  ctx: RenderContext,
): Promise<void> {
  const textKey = entry.property ? Object.keys(instance.componentProperties ?? {}).find((key) => key.startsWith(`${entry.property}#`)) : undefined;
  if (textKey) {
    instance.setProperties({ [textKey]: entry.text });
    return;
  }
  const node = namedTextNode(instance, entry.part);
  if (!node) {
    if (only) await setComposedChildText(instance, entry.text, entry.part, block, ctx);
    else ctx.unresolvedComposedChildren.push({ slot: entry.part, component: block, reason: `block instance has no text node to receive "${entry.text}"` });
    return;
  }
  const fonts = node.fontName === figma.mixed ? node.getRangeAllFontNames(0, node.characters.length) : [node.fontName];
  for (const font of fonts) await figma.loadFontAsync(font);
  node.characters = entry.text;
}

/** A declared slot that fell back to baked, non-swappable content (the plugin's `DegradedSlot`). */
export interface DegradedSlot {
  name: string;
  reason: string;
}

/** A composed-child slot whose default instance could not be created (the plugin's `UnresolvedComposedChild`). */
export interface UnresolvedComposedChild {
  slot: string;
  component: string;
  reason: string;
}

/** Key of a composed child's generated component in `RenderContext.composedChildren`. */
export function composedChildKeyOf(component: string, label: string): string {
  return `${component}|${label}`;
}

/**
 * Create + configure one native slot on the variant root. Returns `undefined`
 * (never throws) on any failure — capability absent, or `createSlot()` /
 * `editComponentProperty()` throwing — so one bad slot degrades to baked content
 * (reported in `degradedSlots`) instead of aborting the component.
 */
function configureNativeSlot(run: AnatomyRun, slot: AnatomySlotPlan): SlotNode | undefined {
  const { capability, root, ctx } = run;
  if (!capability.probed) {
    capability.probed = true;
    // A plain `typeof` check: trying and catching would itself call `createSlot()`.
    capability.available = typeof (root as unknown as { createSlot?: unknown }).createSlot === "function";
  }
  if (!capability.available) {
    ctx.degradedSlots.push({ name: slot.name, reason: "native slots unavailable in this Figma build" });
    return undefined;
  }
  try {
    // `createSlot()` also creates a SLOT component property but does not return its name:
    // diff the property keys before/after to find it.
    const before = new Set(Object.keys(root.componentPropertyDefinitions));
    const slotNode = root.createSlot();
    const propertyName = Object.keys(root.componentPropertyDefinitions).find(
      (name) => !before.has(name) && root.componentPropertyDefinitions[name]?.type === "SLOT",
    );
    if (propertyName) {
      const slotSettings: SlotSettings = {};
      // REPORTED, not enforced: Figma lets a designer empty the slot and surfaces BELOW_MIN.
      if (slot.required) slotSettings.minChildren = 1;
      // Insertion-time behaviour only; the slot's own placement is set in `appendMaybeSlotted`.
      if (slot.stretch) slotSettings.stretchChildOnInsert = true;
      root.editComponentProperty(propertyName, {
        name: slot.name,
        ...(Object.keys(slotSettings).length > 0 ? { slotSettings } : {}),
      });
    } else {
      ctx.degradedSlots.push({
        name: slot.name,
        reason: "created a native slot but couldn't find its SLOT property to rename or apply required/stretch settings",
      });
    }
    slotNode.name = slot.name;
    return slotNode;
  } catch (error) {
    ctx.degradedSlots.push({ name: slot.name, reason: String(error) });
    return undefined;
  }
}

/** The `layoutSizing*` field that fills `parent`'s CROSS axis — what CSS `align-items: stretch` describes. */
function crossAxisFillField(parent: BaseNode): "layoutSizingHorizontal" | "layoutSizingVertical" | undefined {
  if (!("layoutMode" in parent)) return undefined;
  const mode = (parent as FrameNode | ComponentNode).layoutMode;
  if (mode === "HORIZONTAL") return "layoutSizingVertical";
  if (mode === "VERTICAL") return "layoutSizingHorizontal";
  return undefined;
}

/**
 * Place a default-content slot's own frame in `parent`. The slot node IS the container of the
 * default content (the caller appends its children), so it wraps nothing: it only takes its place
 * on `parent`'s cross axis (FILL for a stretching slot).
 */
function appendSlotFrame(parent: BaseNode & ChildrenMixin, slotNode: SlotNode, slot: AnatomySlotPlan): SceneNode {
  parent.appendChild(slotNode);
  const fillField = crossAxisFillField(parent);
  if (fillField) setLayoutSizing(slotNode, fillField, slot.stretch ? "FILL" : "HUG");
  return slotNode;
}

/**
 * Append `content` to `parent`, wrapped in a native slot when `slot` is set and the
 * capability is available — otherwise `content` is appended directly (baked content).
 * The wrapper hugs `content` and has no fill, so a slot reads identically to the plain
 * node it replaces until a designer swaps its content. Returns what `parent` now holds.
 */
function appendMaybeSlotted(
  parent: BaseNode & ChildrenMixin,
  content: SceneNode,
  slot: AnatomySlotPlan | undefined,
  run: AnatomyRun,
): SceneNode {
  const slotNode = slot && !run.suppressSlots ? configureNativeSlot(run, slot) : undefined;
  if (!slotNode) {
    parent.appendChild(content);
    return content;
  }
  slotNode.layoutMode = "HORIZONTAL";
  slotNode.primaryAxisSizingMode = "AUTO";
  slotNode.counterAxisSizingMode = "AUTO";
  slotNode.counterAxisAlignItems = "CENTER";
  slotNode.fills = [];
  slotNode.appendChild(content);
  parent.appendChild(slotNode);
  // AFTER appendChild: `layoutSizing*` is only writable on a parented node, and Figma's
  // slot initialisation may override the AUTO set above.
  const fillField = crossAxisFillField(parent);
  if (fillField) setLayoutSizing(slotNode, fillField, slot?.stretch ? "FILL" : "HUG");
  return slotNode;
}

/** Figma's `resize()` contract: finite and at least 0.01. Anything else is refused by name. */
function isFigmaLength(px: number): boolean {
  return Number.isFinite(px) && px >= 0.01;
}

/**
 * A child's own `layoutAlign` of MIN, CENTER or MAX is deprecated in Figma: cross-axis alignment
 * belongs on the parent's `counterAxisAlignItems`, which the compiled artifact already carries.
 * No wrapper frame is added to fake a per-child placement, and nothing is approximated, so an
 * artifact that still names a per-child `alignSelf` (built before the alignment moved to the
 * parent) is refused and reported rather than applied. Rebuild the artifact to clear it.
 */
export function applyAlignSelf(
  part: string,
  alignSelf: "MIN" | "CENTER" | "MAX" | undefined,
  refusals: string[],
): void {
  if (!alignSelf) return;
  refusals.push(
    `${part} alignSelf: ${alignSelf} is carried by the parent's counterAxisAlignItems, not a per-child layoutAlign; rebuild the artifact`,
  );
}

function applyLiteralSize(node: SceneNode, plan: AnatomyNodePlan, refusals: string[]): void {
  if (!("resize" in node)) return;
  const usable = (axis: "width" | "height", px: number | undefined): px is number => {
    if (px === undefined) return false;
    if (isFigmaLength(px)) return true;
    refusals.push(`${plan.part} ${axis}: unusable length (${px})`);
    return false;
  };
  const width = usable("width", plan.width) ? plan.width : undefined;
  const height = usable("height", plan.height) ? plan.height : undefined;
  if (width !== undefined || height !== undefined) node.resize(width ?? node.width, height ?? node.height);
}

/** Resolve a FLOAT variable to its first-mode number, so an icon placeholder can take the token's real size. */
function floatValueOf(token: string | undefined, index: VarIndex): number | undefined {
  const variable = token ? variableFor(token, index) : null;
  if (!variable || variable.resolvedType !== "FLOAT") return undefined;
  return Object.values(variable.valuesByMode).find((value): value is number => typeof value === "number");
}

/**
 * The geometry fields behind Figma's size limits, clipping and wrapping, read off either a part's
 * `AnatomyGeometry` or a root cell's merged geometry: `minWidth`/`maxWidth`/`minHeight`/
 * `maxHeight` (bound to a variable where the CSS names one token, else the px literal it states),
 * `clipsContent` and `layoutWrap` with `counterAxisSpacing`. Same rule as the plugin walker's
 * `applyLayoutExtras`.
 */
export interface LayoutExtrasGeometry {
  minWidth?: string;
  maxWidth?: string;
  minHeight?: string;
  maxHeight?: string;
  minWidthPx?: number;
  maxWidthPx?: number;
  minHeightPx?: number;
  maxHeightPx?: number;
  clipsContent?: true;
  layoutWrap?: "WRAP";
  counterAxisSpacing?: string;
}

const SIZE_LIMIT_FIELDS = ["minWidth", "maxWidth", "minHeight", "maxHeight"] as const;

/**
 * Figma accepts a size limit only on an auto-layout frame or a direct child of one, and wrapping
 * only on a horizontal auto-layout frame. A node that cannot carry one is reported in
 * `ctx.refusedSizes` instead of written, so the run never fails half-way.
 */
export function applyLayoutExtras(node: SceneNode, g: LayoutExtrasGeometry, label: string, ctx: RenderContext): void {
  for (const field of SIZE_LIMIT_FIELDS) {
    const token = g[field];
    const px = g[`${field}Px`];
    if (token === undefined && px === undefined) continue;
    try {
      if (token !== undefined) {
        const variable = variableFor(token, ctx.index);
        if (variable) (node as SceneNode & { setBoundVariable(f: VariableBindableNodeField, v: Variable): void }).setBoundVariable(field, variable);
        else if (!ctx.unresolvedBindings.includes(token)) ctx.unresolvedBindings.push(token);
      } else {
        (node as SceneNode & { minWidth: number | null })[field] = px as number;
      }
    } catch (error) {
      ctx.refusedSizes.push(`${label} ${field}: Figma refused the limit (${String(error)})`);
    }
  }
  if (g.clipsContent && "clipsContent" in node) node.clipsContent = true;
  if (g.layoutWrap === "WRAP") {
    if ("layoutMode" in node && node.layoutMode === "HORIZONTAL") {
      node.layoutWrap = "WRAP";
      const spacing = g.counterAxisSpacing ? variableFor(g.counterAxisSpacing, ctx.index) : null;
      if (spacing) node.setBoundVariable("counterAxisSpacing", spacing);
      else if (g.counterAxisSpacing && !ctx.unresolvedBindings.includes(g.counterAxisSpacing)) ctx.unresolvedBindings.push(g.counterAxisSpacing);
    } else {
      ctx.refusedSizes.push(`${label} layoutWrap: only a horizontal auto-layout frame wraps`);
    }
  }
}

/**
 * Place a child of an overlay frame at its percentage insets and pin it with `constraints` SCALE,
 * mirroring the plugin's `applyDeferredInsetPlacement`: position first, then constraints.
 */
/**
 * `100%` on a part, routed by where the part actually lives.
 *
 * Inside an auto-layout parent that is FILL, which `applyAxisSizing` handles.
 * Inside an overlay frame (`layoutMode: NONE`) `layoutSizing*` throws — the
 * parent flows nothing — but the CSS is not unsupported there, merely expressed
 * differently: an absolutely positioned box of `100%` spans its containing
 * block, which in Figma is a STRETCH constraint over a full-bleed box. Deferring
 * it matters because the parent's own size lands last (see `applyCellBox`), so
 * the span is taken from the final box rather than the hug it had mid-build.
 */
function applyPartAxisSizing(
  node: SceneNode & LayoutMixin,
  axis: "width" | "height",
  sizing: AxisSizing | undefined,
  label: string,
  run: AnatomyRun,
): void {
  const parent = node.parent;
  const overlay = parent as unknown as { layoutMode?: string } | null;
  if (sizing?.mode === "fill" && parent && "layoutMode" in parent && overlay?.layoutMode === "NONE") {
    run.deferredAbsoluteFill.push({ child: node, parent, axis, label });
    return;
  }
  applyAxisSizing(node, axis, sizing, label, run.ctx);
}

/**
 * Stretch each `100%` child of an overlay frame over the parent's final box.
 * Runs FIRST of the deferred passes: it is the fallback for a part that declares
 * `100%` and nothing else, so the more specific instructions that follow — an
 * `overlayCrossAlign` placement, an explicit percentage inset — still win.
 */
function applyDeferredAbsoluteFill(run: AnatomyRun): void {
  for (const { child, parent, axis, label } of run.deferredAbsoluteFill) {
    if (!("constraints" in child) || !("resize" in child)) {
      run.ctx.refusedSizes.push(`${label} ${axis}: 100% on a node that takes no constraints`);
      continue;
    }
    const frame = parent as unknown as { width: number; height: number };
    const length = axis === "width" ? frame.width : frame.height;
    if (!isFigmaLength(length)) {
      run.ctx.refusedSizes.push(`${label} ${axis}: 100% of an unusable parent length (${length})`);
      continue;
    }
    const node = child as SceneNode & ConstraintMixin & LayoutMixin;
    if (axis === "width") {
      node.resize(length, node.height);
      node.x = 0;
      node.constraints = { horizontal: "STRETCH", vertical: node.constraints.vertical };
    } else {
      node.resize(node.width, length);
      node.y = 0;
      node.constraints = { horizontal: node.constraints.horizontal, vertical: "STRETCH" };
    }
  }
}

function applyDeferredInsetPlacement(run: AnatomyRun): void {
  for (const { child, parent, constraints, insetPercent, label } of run.deferredInsetPlacement) {
    const frame = parent as unknown as { layoutMode?: string; width: number; height: number };
    if (!("layoutMode" in parent) || frame.layoutMode !== "NONE") {
      run.ctx.refusedSizes.push(`${label} inset: percentage insets need a non-auto-layout parent`);
      continue;
    }
    if (!("constraints" in child) || !("x" in child)) {
      run.ctx.refusedSizes.push(`${label} inset: node does not support constraints`);
      continue;
    }
    const node = child as SceneNode & ConstraintMixin & LayoutMixin;
    const place = (start: number | undefined, end: number | undefined, parentLength: number, length: number) => {
      if (start !== undefined && end !== undefined) return { offset: (parentLength * start) / 100, length: parentLength * (1 - (start + end) / 100) };
      if (start !== undefined) return { offset: (parentLength * start) / 100, length };
      if (end !== undefined) return { offset: parentLength - (parentLength * end) / 100 - length, length };
      return { offset: 0, length };
    };
    if (constraints.horizontal) {
      const next = place(insetPercent.left, insetPercent.right, frame.width, node.width);
      if (next.length !== node.width && isFigmaLength(next.length)) node.resize(next.length, node.height);
      node.x = next.offset;
    }
    if (constraints.vertical) {
      const next = place(insetPercent.top, insetPercent.bottom, frame.height, node.height);
      if (next.length !== node.height && isFigmaLength(next.length)) node.resize(node.width, next.length);
      node.y = next.offset;
    }
    node.constraints = {
      horizontal: constraints.horizontal ?? node.constraints.horizontal,
      vertical: constraints.vertical ?? node.constraints.vertical,
    };
  }
}

/** Bind the node's own tokens: padding/gap/radius/border/opacity, plus a literal radius. */
function applyAnatomyGeometry(node: SceneNode, plan: AnatomyNodePlan, ctx: RenderContext): void {
  const bind = (field: VariableBindableNodeField, token: string | undefined, blocking = true) => {
    if (!token) return;
    const variable = variableFor(token, ctx.index);
    if (!variable) {
      if (blocking) ctx.unresolvedBindings.push(token);
      return;
    }
    try {
      (node as SceneNode & { setBoundVariable(f: VariableBindableNodeField, v: Variable): void }).setBoundVariable(field, variable);
    } catch {
      ctx.unresolvedBindings.push(`${token} (cannot bind ${field} on ${node.type.toLowerCase()})`);
    }
  };
  const g = plan.geometry;
  if ("paddingLeft" in node) {
    bind("paddingLeft", g.paddingLeft ?? g.paddingInline);
    bind("paddingRight", g.paddingRight ?? g.paddingInline, g.paddingRight !== undefined);
    bind("paddingTop", g.paddingTop ?? g.paddingBlock);
    bind("paddingBottom", g.paddingBottom ?? g.paddingBlock, g.paddingBottom !== undefined);
    bind("itemSpacing", g.gap);
  }
  if (g.radius && "topLeftRadius" in node) {
    const variable = variableFor(g.radius, ctx.index);
    if (variable) {
      for (const corner of ["topLeftRadius", "topRightRadius", "bottomLeftRadius", "bottomRightRadius"] as const) {
        (node as RectangleNode).setBoundVariable(corner, variable);
      }
    } else {
      ctx.unresolvedBindings.push(g.radius);
    }
  }
  if (g.radiusPx !== undefined && "cornerRadius" in node) (node as unknown as { cornerRadius: number }).cornerRadius = g.radiusPx;
  bind("strokeWeight", g.borderWidth);
  bindSideStrokeWeights(node, g, ctx);
  bind("opacity", g.opacity);
  applyLiteralSize(node, plan, ctx.refusedSizes);
}

/** Fill + stroke, bound by name. Text/icon take the part's text colour; no binding means no paint. */
function applyAnatomyPaints(node: SceneNode, plan: AnatomyNodePlan, ctx: RenderContext): void {
  const fillToken = plan.kind === "text" || plan.kind === "icon" ? (plan.text ?? plan.fill) : plan.fill;
  if (plan.kind === "icon") {
    // The glyph's leaves carry the colour, never the wrapper frame (that would paint a square behind it).
    if (fillToken && !bindIconPaint(node, fillToken, ctx.index)) ctx.unresolvedBindings.push(fillToken);
  } else if (plan.kind === "image") {
    // The asset IS the content: a background colour has no meaning behind an image, and the generic
    // branch below would wipe the IMAGE paint (or replace it with a solid). Same rule as the plugin.
  } else if (plan.kind === "text" && fillToken) {
    if (!bindTextColor(node as TextNode, fillToken, ctx.index)) ctx.unresolvedBindings.push(fillToken);
  } else if (fillToken) {
    if (!bindFill(node as SceneNode & { fills: ReadonlyArray<Paint> }, fillToken, ctx.index, plan.fillOpacity)) ctx.unresolvedBindings.push(fillToken);
  } else {
    (node as GeometryMixin).fills = [];
  }
  if (plan.stroke && !bindStroke(node as SceneNode & MinimalStrokesMixin, plan.stroke, ctx.index, 1, plan.strokeOpacity)) {
    ctx.unresolvedBindings.push(plan.stroke);
  }
}

/** Apply a local effect style by name; reported when the file lacks it. */
async function applyEffectStyle(node: SceneNode, name: string, ctx: RenderContext): Promise<void> {
  const styles = await figma.getLocalEffectStylesAsync();
  // By name, separator-insensitively: the plugin looks `shadow/neutral-mid` up as `shadow/neutral/mid`.
  const style = styles.find((candidate) => candidate.name === name) ?? styles.find((candidate) => normalizeVarName(candidate.name) === normalizeVarName(name));
  if (!style || !("setEffectStyleIdAsync" in node)) {
    ctx.unresolvedBindings.push(`effect style ${name}`);
    return;
  }
  await (node as unknown as { setEffectStyleIdAsync(id: string): Promise<void> }).setEffectStyleIdAsync(style.id);
}

type TypographyTokens = object;

/**
 * No DS text style: bind every typography field the plugin binds (its `bindTextField` x5) —
 * family, size, weight, line height, letter spacing — each to its variable by name. A missing
 * variable is reported in `unresolvedSizes`, never replaced by a literal.
 */
function bindTypography(text: TextNode, tokens: TypographyTokens, ctx: RenderContext): void {
  const read = tokens as Record<string, unknown>;
  for (const field of ["fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing"] as const) {
    const token = read[field];
    if (typeof token !== "string" || !token) continue;
    const variable = variableFor(token, ctx.index);
    if (variable) text.setBoundVariable(field, variable);
    else if (!ctx.unresolvedSizes.includes(token)) ctx.unresolvedSizes.push(token);
  }
}

/** A text node for an anatomy part: the DS text style when the file has it, else bound typography. */
async function createAnatomyText(characters: string, plan: AnatomyNodePlan, ctx: RenderContext): Promise<TextNode> {
  // No literal size: the style or the bound typography sizes it, as in the plugin.
  const text = await createText(characters, FONT_FAMILY_FALLBACK, "Regular");
  const g = plan.geometry;
  const styleId = g.textStyle ? textStyleFor(g.textStyle, ctx.textStyles) : null;
  if (styleId) {
    // The style re-fonts the node, so its font must be loaded BEFORE it is applied:
    // every mutation below (`fontSize`, `lineHeight`, `textAlignHorizontal`, `textCase`)
    // writes to a node that now carries the style's font, and Figma rejects a write to a
    // node with an unloaded font. `createText` only loaded the fallback family.
    await loadTextStyleFont(styleId);
    await text.setTextStyleIdAsync(styleId);
  } else {
    bindTypography(text, g, ctx);
  }
  // The contract's literal font size / line height (`literalGeometry`) win AFTER the style,
  // because `setTextStyleIdAsync` rewrites every property the style bundles.
  if (plan.fontSize !== undefined) text.fontSize = plan.fontSize;
  if (plan.lineHeight !== undefined) {
    text.lineHeight =
      plan.lineHeightUnit === "unitless"
        ? { unit: "PERCENT", value: plan.lineHeight * 100 }
        : { unit: "PIXELS", value: plan.lineHeight };
  }
  if (g.textAlignHorizontal) text.textAlignHorizontal = g.textAlignHorizontal;
  // After the style, which carries no case of its own (CSS `text-transform`).
  if (g.textCase) text.textCase = g.textCase;
  return text;
}

function applyComposedChildCorner(
  instance: InstanceNode,
  field: "topLeftRadius" | "topRightRadius" | "bottomLeftRadius" | "bottomRightRadius",
  value: ComposedChildOverrideBinding["topLeftRadius"],
  ctx: RenderContext,
): void {
  if (!value) return;
  if (value.kind === "literal") {
    instance[field] = value.px;
    return;
  }
  const variable = variableFor(value.name, ctx.index);
  if (variable) instance.setBoundVariable(field, variable);
  else ctx.unresolvedBindings.push(value.name);
}

/**
 * Put an instance's horizontal sizing mode back after `resize()` reset both axes to FIXED.
 * HUG, FILL and FIXED are all restored as saved, so call order against a later FILL assignment
 * cannot change the outcome. Restoring FILL on an unparented node is refused by Figma; that
 * refusal is swallowed because the parent's own FILL pass re-applies it after append.
 */
function restoreHorizontalSizing(
  instance: InstanceNode,
  saved: InstanceNode["layoutSizingHorizontal"],
): void {
  if (instance.layoutSizingHorizontal === saved) return;
  try {
    instance.layoutSizingHorizontal = saved;
  } catch {
    // Not yet parented in an auto-layout frame: the append-time pass applies FILL.
  }
}

/**
 * This parent's descendant overrides for ONE repeat position, applied to the INSTANCE
 * only — the child's own component definition is never touched.
 */
export async function applyComposedChildOverride(
  instance: InstanceNode,
  override: ComposedChildOverrideBinding | undefined,
  ctx: RenderContext,
): Promise<void> {
  if (!override) return;
  applyComposedChildCorner(instance, "topLeftRadius", override.topLeftRadius, ctx);
  applyComposedChildCorner(instance, "topRightRadius", override.topRightRadius, ctx);
  applyComposedChildCorner(instance, "bottomLeftRadius", override.bottomLeftRadius, ctx);
  applyComposedChildCorner(instance, "bottomRightRadius", override.bottomRightRadius, ctx);
  if (override.height?.kind === "literal") {
    // `resize` fixes both axes: restore the horizontal mode (HUG, FILL or FIXED) exactly.
    const horizontalSizing = instance.layoutSizingHorizontal;
    instance.resize(instance.width, override.height.px);
    restoreHorizontalSizing(instance, horizontalSizing);
  } else if (override.height?.kind === "fill") {
    // The item is exactly its parent's padded track: stretch across the cross axis.
    // FILL is legal only where the instance actually landed; elsewhere it is refused and reported.
    if (!setLayoutSizing(instance, "layoutSizingVertical", "FILL")) {
      ctx.refusedSizes.push("composed child height: FILL needs an auto-layout parent; the item keeps its own height");
    }
  }
  if (override.fill && !bindFill(instance, override.fill, ctx.index)) ctx.unresolvedBindings.push(override.fill);
  if (override.stroke && !bindStroke(instance, override.stroke, ctx.index, 1)) ctx.unresolvedBindings.push(override.stroke);
  if (override.effectStyle) await applyEffectStyle(instance, override.effectStyle, ctx);
}

/**
 * The composed child's own text node: the first TEXT in document order that is not inside a
 * nested instance, so a nested composed child's text is never the one overridden.
 */
export function ownTextNode(node: BaseNode & ChildrenMixin): TextNode | undefined {
  for (const child of node.children) {
    if (child.type === "TEXT") return child;
    if (child.type === "INSTANCE" || !("children" in child)) continue;
    const found = ownTextNode(child);
    if (found) return found;
  }
  return undefined;
}

/**
 * Sets the text of a composed-child instance to the documentation example's own copy. The child
 * has exactly one text slot or text property (checked when the contract compiles), so the instance has one text
 * node; its font is loaded first, since Figma refuses to write `characters` otherwise.
 */
async function setComposedChildText(
  instance: InstanceNode,
  characters: string,
  slot: string,
  component: string,
  ctx: RenderContext,
): Promise<void> {
  const text = ownTextNode(instance);
  if (!text) {
    ctx.unresolvedComposedChildren.push({ slot, component, reason: "composed child has no text node to receive the example text" });
    return;
  }
  const fonts = text.fontName === figma.mixed ? text.getRangeAllFontNames(0, text.characters.length) : [text.fontName];
  for (const font of fonts) await figma.loadFontAsync(font);
  // A child with a text property takes its text through that property: writing the characters of a
  // node the property drives would be undone by the property.
  const textKey = Object.entries(instance.componentProperties ?? {}).find(([, definition]) => definition.type === "TEXT")?.[0];
  if (textKey) {
    instance.setProperties({ [textKey]: characters });
    return;
  }
  text.characters = characters;
}

/**
 * A node's own content: the composed child's default INSTANCE when its slot
 * declares one, else the slot's example text. Wrapped in the native slot when there is one.
 */
export async function appendAnatomyContent(
  parent: BaseNode & ChildrenMixin,
  plan: AnatomyNodePlan,
  run: AnatomyRun,
  repeatIndex = 0,
): Promise<void> {
  const { ctx } = run;
  const ref: ComposedChildRef | undefined = plan.slot?.composedChild;
  if (plan.slot && ref) {
    const label = ctx.composedChildLabels[composedChildRequestKey(plan.slot.name, plan.slot.composedChildAxisValues)];
    const child = label ? ctx.composedChildren.get(composedChildKeyOf(ref.component, label)) : undefined;
    if (child) {
      // An INSTANCE of the child's own generated component, not a frozen copy: it inherits the
      // child's bindings and geometry and stays swappable.
      const instance = createInstanceOf(child);
      instance.name = `${plan.part} content`;
      // Applied AFTER insertion: a native slot's `stretchChildOnInsert` may stretch the child
      // on insert, which would otherwise replace the override's fixed height.
      appendMaybeSlotted(parent, instance, plan.slot, run);
      await applyComposedChildOverride(instance, plan.composedChildOverridesByIndex?.[repeatIndex], ctx);
      // The documentation example's own text for this instance, set on the instance's text so it
      // stays linked to its main component.
      if (plan.characters !== undefined) await setComposedChildText(instance, plan.characters, plan.slot.name, ref.component, ctx);
      return;
    }
    // Reported, not thrown: one unresolvable child degrades that slot, not the component.
    ctx.unresolvedComposedChildren.push({
      slot: plan.slot.name,
      component: ref.component,
      reason: label
        ? "composed child's default variant was not found among generated components"
        : "composed child's variant key matches no cell of the child component",
    });
  }
  // A padded text part always holds its text, empty or not, as a text part does: the copy stays
  // editable and its text property has a node to drive.
  const characters = plan.paddedText ? (plan.characters ?? plan.part) : plan.characters;
  if (!characters && !plan.paddedText) return;
  const text = await createAnatomyText(characters ?? "", plan, ctx);
  text.name = `${plan.part} content`;
  const colour = plan.text ?? plan.fill;
  if (colour && !bindTextColor(text, colour, ctx.index)) ctx.unresolvedBindings.push(colour);
  const placed = appendMaybeSlotted(parent, text, plan.slot, run);
  // A padded text part that fills its width wraps inside its frame, as the text node it replaces
  // did: the copy (and the native slot around it, if any) fills the frame and grows downward.
  if (plan.paddedText && plan.sizing.width?.mode === "fill") {
    if (placed !== text) setLayoutSizing(placed, "layoutSizingHorizontal", "FILL");
    setLayoutSizing(text, "layoutSizingHorizontal", "FILL");
    text.textAutoResize = "HEIGHT";
  }
  // The part's text property drives this text, the node that holds the copy.
  if (run.properties && plan.properties?.characters) {
    run.properties.bindings.push({ node: text, references: { characters: plan.properties.characters } });
  }
}

/** Direction + alignment for an anatomy frame; an `overlay` is positioned, not flowed, and must not clip. */
function applyAnatomyLayout(frame: FrameNode, plan: AnatomyNodePlan): void {
  // The contract's authored `layout` wins, then the CSS-derived direction, then CSS's own row default.
  const layout = plan.layout ?? (plan.geometry.layoutMode === "VERTICAL" ? "vertical" : "horizontal");
  frame.layoutMode = layout === "overlay" ? "NONE" : layout === "vertical" ? "VERTICAL" : "HORIZONTAL";
  if (frame.layoutMode === "NONE") {
    frame.clipsContent = false;
    return;
  }
  frame.primaryAxisSizingMode = "AUTO";
  frame.counterAxisSizingMode = "AUTO";
  frame.counterAxisAlignItems = plan.geometry.counterAxisAlignItems ?? "MIN";
  frame.primaryAxisAlignItems = plan.geometry.primaryAxisAlignItems ?? "MIN";
}

/** An overlay's LENGTH axis, read off its own sizing plan (the axis the CSS marks `fill`). */
function overlayMainAxis(plan: AnatomyNodePlan): "width" | "height" | undefined {
  const widthFill = plan.sizing.width?.mode === "fill";
  const heightFill = plan.sizing.height?.mode === "fill";
  if (widthFill && !heightFill) return "width";
  if (heightFill && !widthFill) return "height";
  return undefined;
}

/**
 * Place overlay children on the axis ACROSS their parent's long direction, once the
 * parent's box is final, then position / length ALONG it, mirroring the plugin's `applyDeferredOverlayAlignment`.
 */
function applyDeferredOverlayAlignment(run: AnatomyRun): void {
  for (const { child, parent, align, label, mainAxis, positionAlongMain, sizeAlongMain } of run.deferredOverlay) {
    if (parent.layoutMode !== "NONE") {
      run.ctx.refusedSizes.push(`${label} overlayCrossAlign: parent is not an overlay`);
      continue;
    }
    const horizontalIsMain = mainAxis ? mainAxis === "width" : parent.width >= parent.height;
    if ("constraints" in child) {
      const constraint: ConstraintType = align === "stretch" ? "STRETCH" : align === "start" ? "MIN" : align === "end" ? "MAX" : "CENTER";
      const node = child as SceneNode & ConstraintMixin;
      node.constraints = horizontalIsMain
        ? { horizontal: node.constraints.horizontal, vertical: constraint }
        : { horizontal: constraint, vertical: node.constraints.vertical };
    }
    if (align === "stretch") {
      const crossSize = horizontalIsMain ? parent.height : parent.width;
      if ("resize" in child && crossSize > 0) {
        if (horizontalIsMain) child.resize(child.width, crossSize);
        else child.resize(crossSize, child.height);
      } else {
        run.ctx.refusedSizes.push(`${label} overlayCrossAlign stretch: unusable parent size (${crossSize})`);
      }
      if (horizontalIsMain) child.y = 0;
      else child.x = 0;
    } else {
      const slack = horizontalIsMain ? parent.height - child.height : parent.width - child.width;
      const offset = align === "start" ? 0 : align === "end" ? slack : slack / 2;
      if (horizontalIsMain) child.y = offset;
      else child.x = offset;
    }
    applyAlongMainPlacement(child, horizontalIsMain, horizontalIsMain ? parent.width : parent.height, positionAlongMain, sizeAlongMain, label, run.ctx.refusedSizes);
  }
}

/**
 * Mirroring the plugin's `applyAlongMainPlacement`: a value-driven LENGTH pinned at the
 * parent's main-axis origin, then the position (`travel` through the free space, `valueOf` centred
 * AT the fraction, `stretch`, or a literal `start` / `center` / `end` anchor). A `refused` position
 * is never rendered at a guessed offset.
 */
function applyAlongMainPlacement(
  child: SceneNode,
  horizontalIsMain: boolean,
  mainLength: number,
  positionAlongMain: ResolvedPositionAlongMain | undefined,
  sizeAlongMain: ResolvedSizeAlongMain | undefined,
  label: string,
  refusals: string[],
): void {
  const setMain = (offset: number) => {
    if (horizontalIsMain) child.x = offset;
    else child.y = offset;
  };
  const childMain = () => (horizontalIsMain ? child.width : child.height);
  if (sizeAlongMain) {
    if (!("resize" in child) || !(mainLength > 0)) {
      refusals.push(`${label} sizeAlongMain: unusable parent length (${mainLength})`);
    } else {
      const length = mainLength * sizeAlongMain.fraction;
      // A 0% value draws no indicator; Figma's `resize()` refuses below 0.01, so the
      // plugin hides the node rather than throwing (mirrored here).
      if (length === 0) child.visible = false;
      else if (!(length >= 0.01)) refusals.push(`${label} sizeAlongMain: unusable length (${length})`);
      else if (horizontalIsMain) child.resize(length, child.height);
      else child.resize(child.width, length);
    }
    setMain(0);
  }
  if (!positionAlongMain || positionAlongMain.kind === "refused") return;
  if (positionAlongMain.kind === "stretch") {
    if ("resize" in child && mainLength > 0) {
      if (horizontalIsMain) child.resize(mainLength, child.height);
      else child.resize(child.width, mainLength);
    } else if (!(mainLength > 0)) {
      refusals.push(`${label} positionAlongMain stretch: unusable parent length (${mainLength})`);
    }
    setMain(0);
    return;
  }
  if (positionAlongMain.kind === "travel" || positionAlongMain.kind === "valueOf") {
    if (!(mainLength > 0)) {
      refusals.push(`${label} positionAlongMain: unusable parent length (${mainLength})`);
      return;
    }
    setMain(
      positionAlongMain.kind === "travel"
        ? (mainLength - childMain()) * positionAlongMain.fraction
        : mainLength * positionAlongMain.fraction - childMain() / 2,
    );
    return;
  }
  const slack = mainLength - childMain();
  setMain(positionAlongMain.kind === "start" ? 0 : positionAlongMain.kind === "end" ? slack : slack / 2);
}

/** The declared runtime sizes of a node's sizing plan, per physical axis, or `undefined` when none. */
function runtimeSizeOf(plan: AnatomyNodePlan): { width?: number; height?: number } | undefined {
  const width = plan.sizing.width?.mode === "runtime" ? plan.sizing.width.fraction : undefined;
  const height = plan.sizing.height?.mode === "runtime" ? plan.sizing.height.fraction : undefined;
  return width === undefined && height === undefined ? undefined : { width, height };
}

const ANCHOR_CONSTRAINT = { start: "MIN", end: "MAX", center: "CENTER", stretch: "STRETCH" } as const;

/**
 * Mirroring the plugin's `applyDeferredRemoveFromFlow`: exempt each `removeFromFlow`
 * child of an AUTO-LAYOUT parent from its flow, give it its declared lengths and its anchors against the parent's FINAL box, THEN
 * pin it with `constraints` (Figma's documented order). A child of an overlay parent is already
 * free-positioned: a documented no-op. Anything that cannot be applied is reported.
 */
function applyDeferredRemoveFromFlow(run: AnatomyRun): void {
  const refusals = run.ctx.refusedSizes;
  for (const { child, parent, positionAlongMain, sizeAlongMain, crossAlign, runtimeSize, label } of run.deferredRemoveFromFlow) {
    if (!("layoutMode" in parent)) continue;
    const layoutMode = (parent as FrameNode).layoutMode;
    if (layoutMode !== "HORIZONTAL" && layoutMode !== "VERTICAL") continue;
    if (!("layoutPositioning" in child)) {
      refusals.push(`${label} removeFromFlow: node does not support layoutPositioning`);
      continue;
    }
    // 1. Out of flow first: `x`/`y`/`resize()` are only respected once auto-layout lets go.
    (child as SceneNode & AutoLayoutChildrenMixin).layoutPositioning = "ABSOLUTE";
    const horizontalIsMain = layoutMode === "HORIZONTAL";
    const box = parent as unknown as { width: number; height: number };
    const mainLength = horizontalIsMain ? box.width : box.height;
    const crossLength = horizontalIsMain ? box.height : box.width;
    const resizable = "resize" in child ? (child as SceneNode & LayoutMixin) : undefined;
    // 2a. Declared LENGTHS first — every offset below depends on the child's final size.
    const lengths: { width?: number; height?: number } = { ...runtimeSize };
    if (sizeAlongMain) lengths[horizontalIsMain ? "width" : "height"] = sizeAlongMain.fraction;
    for (const axis of ["width", "height"] as const) {
      const fraction = lengths[axis];
      if (fraction === undefined) continue;
      const length = box[axis] * fraction;
      // Figma rejects a `resize()` below 0.01: a 0% length or an unsized parent is refused.
      if (!resizable || !(length >= 0.01)) {
        refusals.push(`${label} declared ${axis}: unusable length (${length})`);
        continue;
      }
      if (axis === "width") resizable.resize(length, resizable.height);
      else resizable.resize(resizable.width, length);
    }
    // 2b. The main-axis anchor.
    if (positionAlongMain) {
      if (positionAlongMain.kind === "valueOf" || positionAlongMain.kind === "refused") {
        refusals.push(`${label} removeFromFlow positionAlongMain ${positionAlongMain.kind}: no static geometry recipe for a removeFromFlow child`);
      } else if (!(mainLength > 0)) {
        refusals.push(`${label} removeFromFlow positionAlongMain: unusable parent length (${mainLength})`);
      } else if (positionAlongMain.kind === "stretch") {
        if (resizable) {
          if (horizontalIsMain) resizable.resize(mainLength, resizable.height);
          else resizable.resize(resizable.width, mainLength);
        }
        if (horizontalIsMain) child.x = 0;
        else child.y = 0;
      } else {
        const slack = mainLength - (horizontalIsMain ? child.width : child.height);
        // `travel`: a fraction of the FREE space, so the child stays inside its parent (a scroll thumb).
        const offset =
          positionAlongMain.kind === "travel"
            ? slack * positionAlongMain.fraction
            : positionAlongMain.kind === "start"
              ? 0
              : positionAlongMain.kind === "end"
                ? slack
                : slack / 2;
        if (horizontalIsMain) child.x = offset;
        else child.y = offset;
      }
    }
    // 2c. The cross-axis anchor.
    if (crossAlign) {
      if (!(crossLength > 0)) {
        refusals.push(`${label} removeFromFlow crossAlign: unusable parent length (${crossLength})`);
      } else if (crossAlign === "stretch") {
        if (resizable) {
          if (horizontalIsMain) resizable.resize(resizable.width, crossLength);
          else resizable.resize(crossLength, resizable.height);
        }
        if (horizontalIsMain) child.y = 0;
        else child.x = 0;
      } else {
        const slack = crossLength - (horizontalIsMain ? child.height : child.width);
        const offset = crossAlign === "start" ? 0 : crossAlign === "end" ? slack : slack / 2;
        if (horizontalIsMain) child.y = offset;
        else child.x = offset;
      }
    }
    // 3. THEN constraints, so a later resize of the parent keeps this placement.
    if (!("constraints" in child)) continue;
    const node = child as SceneNode & ConstraintMixin;
    const literalAnchor = positionAlongMain && positionAlongMain.kind in ANCHOR_CONSTRAINT ? ANCHOR_CONSTRAINT[positionAlongMain.kind as keyof typeof ANCHOR_CONSTRAINT] : undefined;
    // A value-driven placement is a snapshot pinned at the start edge: the value is an example.
    const mainConstraint: ConstraintType | undefined = literalAnchor ?? (positionAlongMain?.kind === "travel" || sizeAlongMain ? "MIN" : undefined);
    const crossConstraint: ConstraintType | undefined = crossAlign ? ANCHOR_CONSTRAINT[crossAlign] : undefined;
    // A declared runtime size of 100% is the parent's own length: pinned with STRETCH so it keeps
    // spanning the parent (a tab whose label changes). Any other percent stays a static length.
    const runtimeStretch = (fraction: number | undefined): ConstraintType | undefined => (fraction === 1 ? "STRETCH" : undefined);
    node.constraints = {
      horizontal:
        runtimeStretch(runtimeSize?.width) ??
        (horizontalIsMain ? (mainConstraint ?? node.constraints.horizontal) : (crossConstraint ?? node.constraints.horizontal)),
      vertical:
        runtimeStretch(runtimeSize?.height) ??
        (horizontalIsMain ? (crossConstraint ?? node.constraints.vertical) : (mainConstraint ?? node.constraints.vertical)),
    };
  }
}

/** Icon target size: the bound size variable's value, else the contract's literal size, else 12 (as the plugin). */
function iconTargetSize(plan: AnatomyNodePlan, ctx: RenderContext): { width: number; height: number } {
  const width = floatValueOf(plan.sizing.width?.mode === "bind" ? plan.sizing.width.variable : undefined, ctx.index) ?? plan.width ?? 12;
  const height = floatValueOf(plan.sizing.height?.mode === "bind" ? plan.sizing.height.variable : undefined, ctx.index) ?? plan.height ?? 12;
  return { width, height };
}

/** Constrain a node and every descendant to SCALE so an imported SVG's geometry follows a later resize. */
function applyScaleConstraints(node: SceneNode): void {
  if ("constraints" in node) (node as ConstraintMixin).constraints = { horizontal: "SCALE", vertical: "SCALE" };
  if ("children" in node) for (const child of (node as ChildrenMixin).children) applyScaleConstraints(child);
}

/**
 * An icon from its COMPLETE `<svg>` element, through Figma's own importer (the only path that handles
 * arcs, relative commands and H/V; `createVector` silently drops them). Verbatim, no reassembly: the
 * glyph's viewBox and paint channel are the SVG's own. Null on any error so the caller shows a
 * placeholder.
 */
function createIconFrame(svg: string): FrameNode | null {
  try {
    const frame = figma.createNodeFromSvg(svg);
    applyScaleConstraints(frame);
    frame.fills = [];
    return frame;
  } catch {
    return null;
  }
}

/** A VISIBLE failed icon (no `iconSvg`, or the import threw): dashed neutral outline at the icon's size, named for the layers panel. */
function createIconPlaceholderFrame(width: number, height: number, iconName: string): FrameNode {
  const frame = figma.createFrame();
  frame.name = `⚠ icon: ${iconName}`;
  frame.layoutMode = "NONE";
  frame.fills = [];
  frame.strokes = [{ type: "SOLID", color: { r: 0.83, g: 0.83, b: 0.86 } }];
  frame.strokeWeight = 1;
  frame.dashPattern = [2, 2];
  if (width >= 0.01 && height >= 0.01) frame.resize(width, height);
  return frame;
}

const ICON_LEAF_TYPES = new Set(["VECTOR", "ELLIPSE", "RECTANGLE", "POLYGON", "STAR", "LINE"]);

/**
 * Recolour an imported icon with the part's text colour, on whichever paint channel each leaf carries:
 * a leaf with fills gets `fills`, one with strokes gets `strokes`, one with neither (`fill="none"`) is
 * left alone. A stroke-based icon therefore stays an outline. False when the token matches no variable.
 */
function bindIconPaint(node: SceneNode, token: string, index: VarIndex): boolean {
  const variable = variableFor(token, index);
  let paint: SolidPaint = { type: "SOLID", color: { r: 0.83, g: 0.83, b: 0.86 } };
  if (variable) paint = figma.variables.setBoundVariableForPaint(paint, "color", variable);
  const recolor = (target: SceneNode) => {
    if (ICON_LEAF_TYPES.has(target.type)) {
      const geometry = target as unknown as GeometryMixin;
      if (Array.isArray(geometry.fills) && geometry.fills.length > 0) geometry.fills = [paint];
      if (Array.isArray(geometry.strokes) && geometry.strokes.length > 0) geometry.strokes = [paint];
    }
    if ("children" in target) for (const child of (target as ChildrenMixin).children) recolor(child);
  };
  recolor(node);
  return !!variable;
}

/**
 * A `kind: "image"` node's embedded asset, offline: SVG through the SVG importer (`createImage` throws on
 * it), PNG/JPEG/GIF through `createImage` on a rectangle's IMAGE fill. Null on empty/invalid data.
 */
function createImageNode(imageData: string, mimeType: string | undefined): RectangleNode | FrameNode | null {
  try {
    const bytes = decodeBase64(imageData);
    if (bytes.length === 0) return null;
    if (mimeType === "image/svg+xml") {
      const frame = figma.createNodeFromSvg(decodeUtf8(bytes));
      applyScaleConstraints(frame);
      return frame;
    }
    const image = figma.createImage(bytes);
    const rect = figma.createRectangle();
    rect.fills = [{ type: "IMAGE", scaleMode: "FILL", imageHash: image.hash }];
    return rect;
  } catch {
    return null;
  }
}

function applyAspectRatio(node: SceneNode, ratio: number | undefined, label: string, ctx: RenderContext): void {
  if (!ratio || !("resize" in node)) return;
  const height = node.height;
  if (!(height > 0)) {
    ctx.refusedSizes.push(`${label} aspectRatio: unusable height (${height})`);
    return;
  }
  const width = height * ratio;
  if (!isFigmaLength(width)) {
    ctx.refusedSizes.push(`${label} aspectRatio: unusable width (${width})`);
    return;
  }
  node.resize(width, height);
  setLayoutSizing(node, "layoutSizingHorizontal", "FIXED");
}

/** Create one anatomy node (a part, repeated or itemised) under `parent`, then its content and children. */
async function materializeAnatomyNode(
  plan: AnatomyNodePlan,
  parent: BaseNode & ChildrenMixin,
  run: AnatomyRun,
  parentOverlayMainAxis?: "width" | "height",
): Promise<void> {
  const { ctx } = run;
  if (plan.items?.length) {
    for (const item of plan.items) await materializeAnatomyNode(item, parent, run, parentOverlayMainAxis);
    return;
  }
  const repeat = plan.repeat ?? 1;
  for (let index = 0; index < repeat; index++) {
    const iteration = repeat > 1 && plan.characters?.length === repeat ? { ...plan, characters: plan.characters[index] } : plan;
    // A Building Block is an instance of its hidden set, which holds the part's own anatomy,
    // bindings and states: nothing of the part is built here, only placed and sized.
    if (iteration.buildingBlock) {
      const { part, key, copy = [] } = iteration.buildingBlock;
      const block = ctx.buildingBlocks?.get(part);
      const label = block?.matrix.find((cell) => Object.keys(key).every((axis) => cell.key[axis] === key[axis]))?.label;
      const source = label ? block?.variants.get(label) : undefined;
      if (!source) {
        ctx.unresolvedComposedChildren.push({ slot: part, component: part, reason: "the Building Block's variant was not found among generated sets" });
        continue;
      }
      const instance = createInstanceOf(source);
      instance.name = repeat > 1 ? `${iteration.part} ${index + 1}` : iteration.part;
      parent.appendChild(instance);
      // The item's own copy for each text slot the block owns, on the instance.
      for (const entry of copy) await setBlockInstanceText(instance, entry, copy.length === 1, part, ctx);
      // AFTER appendChild: `layoutSizing*` is only writable on a parented node.
      applyPartAxisSizing(instance, "width", iteration.sizing.width, iteration.part, run);
      applyPartAxisSizing(instance, "height", iteration.sizing.height, iteration.part, run);
      continue;
    }
    let node: SceneNode;
    let contentSlot: SlotNode | undefined;
    let failedIcon = false;
    switch (iteration.kind) {
      case "text":
        node = await createAnatomyText(iteration.characters ?? iteration.part, iteration, ctx);
        break;
      case "icon": {
        const { width, height } = iconTargetSize(iteration, ctx);
        // An instance-swap part is an instance of the private icon component, so a designer can
        // swap it; any other icon is a plain imported frame.
        const swap = iteration.properties?.mainComponent;
        const iconComponent = swap && iteration.iconSvg && run.properties ? ensureIconComponent(run.properties, swap.iconName, iteration.iconSvg, { width, height }) : null;
        const glyph: (SceneNode & LayoutMixin & GeometryMixin) | null = iconComponent
          ? createInstanceOf(iconComponent)
          : iteration.iconSvg
            ? createIconFrame(iteration.iconSvg)
            : null;
        if (glyph) {
          if (width >= 0.01 && height >= 0.01) glyph.resize(width, height);
          node = glyph;
        } else {
          // Never silently absent : a visible placeholder, and the failure is reported.
          ctx.failedIconPaths.push(iteration.part);
          node = createIconPlaceholderFrame(width, height, iteration.part);
          failedIcon = true;
        }
        break;
      }
      case "image": {
        const image = iteration.imageData ? createImageNode(iteration.imageData, iteration.imageMimeType) : null;
        if (!image) {
          // As the plugin: no phantom node, but the failure is reported.
          ctx.failedImageAssets.push(iteration.part);
          continue;
        }
        node = image;
        break;
      }
      case "rectangle":
        node = figma.createRectangle();
        break;
      case "ellipse": {
        const ellipse = figma.createEllipse();
        if (iteration.arc) {
          // Radians, clockwise from 3 o'clock; inner radius 1 makes the stroke one open arc.
          const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
          ellipse.arcData = {
            startingAngle: toRadians(iteration.arc.start),
            endingAngle: toRadians(iteration.arc.start + iteration.arc.sweep),
            innerRadius: 1,
          };
        }
        node = ellipse;
        break;
      }
      default: {
        // A default-content slot's frame is the native slot itself (its children are the default
        // content); without native slots it stays a plain frame holding the same children.
        contentSlot = iteration.slot?.defaultContent && !run.suppressSlots ? configureNativeSlot(run, iteration.slot) : undefined;
        const frame = (contentSlot as unknown as FrameNode | undefined) ?? figma.createFrame();
        applyAnatomyLayout(frame, iteration);
        node = frame;
      }
    }
    // A failed icon keeps its `⚠ icon: <part>` name: the visible failure in the layers panel.
    if (!failedIcon) node.name = repeat > 1 ? `${iteration.part} ${index + 1}` : iteration.part;
    if (!failedIcon) applyAnatomyPaints(node, iteration, ctx);
    applyAnatomyGeometry(node, iteration, ctx);
    if (iteration.effectStyle) await applyEffectStyle(node, iteration.effectStyle, ctx);
    // A frame part's own slot is created by `appendAnatomyContent` below (its content is a
    // child); every other kind IS the slotted content, so it wraps itself.
    const parented =
      contentSlot && iteration.slot
        ? appendSlotFrame(parent, contentSlot, iteration.slot)
        : appendMaybeSlotted(parent, node, iteration.kind !== "frame" ? iteration.slot : undefined, run);
    // Component properties are wired once the set exists (`applyComponentProperties`); the node
    // and the fields it drives are recorded here.
    const bound = iteration.properties;
    if (run.properties && bound) {
      const references: PropertyBinding["references"] = {};
      if (bound.characters && node.type === "TEXT") references.characters = bound.characters;
      // An unplaced focus ring stays hidden: the property that shows it is not wired to it.
      const visible = iteration.focusRingUnplaced ? undefined : bound.visible;
      if (visible) references.visible = visible.name;
      if (bound.mainComponent && node.type === "INSTANCE") references.mainComponent = bound.mainComponent.name;
      if (Object.keys(references).length > 0) {
        run.properties.bindings.push({ node, references, ...(visible ? { visibleDefault: visible.default } : {}) });
      }
    }
    // AFTER appendChild: `layoutSizing*` is only writable on a parented node.
    applyPartAxisSizing(node as SceneNode & LayoutMixin, "width", iteration.sizing.width, iteration.part, run);
    applyPartAxisSizing(node as SceneNode & LayoutMixin, "height", iteration.sizing.height, iteration.part, run);
    applyAlignSelf(iteration.part, iteration.geometry.alignSelf, run.ctx.refusedSizes);
    // Size limits, clipping and wrapping, after the node is parented (a limit is legal only on an
    // auto-layout frame or a direct child of one).
    applyLayoutExtras(node, iteration.geometry, iteration.part, ctx);
    if (iteration.geometry.constraints && iteration.geometry.insetPercent) {
      run.deferredInsetPlacement.push({
        child: parented,
        parent,
        constraints: iteration.geometry.constraints,
        insetPercent: iteration.geometry.insetPercent,
        label: iteration.part,
      });
    }
    // Out of the root's flow at once, so the ring (a 100 x 100 frame until it is placed) never adds
    // to the root's size before the deferred sizing, such as its aspect ratio, runs.
    if (iteration.focusRingInset !== undefined || iteration.focusRingUnplaced) takeFocusRingOutOfFlow(parented, parent);
    if (iteration.focusRingUnplaced) {
      // Never shown at a guessed place: hidden in every variant, and reported.
      parented.visible = false;
      ctx.refusedSizes.push(
        `${iteration.part} focus ring: the artifact has no inset for it, so it is not placed outside the root; rebuild the contracts with the token values`,
      );
    }
    if (iteration.focusRingInset !== undefined) {
      run.deferredFocusRings.push({ child: parented, parent, insetPx: iteration.focusRingInset, label: iteration.part });
    }
    for (const entry of iteration.unplaced) if (!ctx.unplacedParts.includes(entry)) ctx.unplacedParts.push(entry);
    const runtimeSize = runtimeSizeOf(iteration);
    if (iteration.removeFromFlow) {
      // a SEPARATE path from the overlay one — exempted from an auto-layout parent's
      // flow via `layoutPositioning` + `constraints`, never via the overlay alignment.
      run.deferredRemoveFromFlow.push({
        child: parented,
        parent,
        positionAlongMain: iteration.positionAlongMain,
        sizeAlongMain: iteration.sizeAlongMain,
        crossAlign: iteration.overlayCrossAlign,
        runtimeSize,
        label: iteration.part,
      });
    } else if (runtimeSize) {
      // The plugin applies a declared runtime size only to an out-of-flow child; anywhere else it
      // would be silently dropped, so the skill reports it instead.
      ctx.refusedSizes.push(`${iteration.part} declared runtime size: not applied outside a removeFromFlow node`);
    }
    if (!iteration.removeFromFlow && iteration.overlayCrossAlign) {
      // `parented`, not `node`: a slotted node sits INSIDE a slot wrapper, which is what `parent` holds.
      run.deferredOverlay.push({
        child: parented,
        parent: parent as FrameNode,
        align: iteration.overlayCrossAlign,
        label: iteration.part,
        // The child's OWN fill axis first: a part with `width: 10px; height: 100%` has
        // stated which way it runs. `parentOverlayMainAxis` is the parent's long
        // direction, a fallback for a part that declares neither axis — and it is wrong
        // for a vertical scrollbar in a landscape viewport, which is how ScrollArea's
        // vertical variants came out full-width and docked to the bottom.
        mainAxis: overlayMainAxis(iteration) ?? parentOverlayMainAxis,
        positionAlongMain: iteration.positionAlongMain,
        sizeAlongMain: iteration.sizeAlongMain,
      });
    }
    if ("appendChild" in node && iteration.kind === "frame") {
      const container = node as BaseNode & ChildrenMixin;
      await appendAnatomyContent(container, iteration, run, index);
      const childOverlayAxis = "layoutMode" in node && (node as FrameNode).layoutMode === "NONE" ? overlayMainAxis(iteration) : undefined;
      // Inside a native slot's default content no further slot is created.
      const childRun = contentSlot ? { ...run, suppressSlots: true } : run;
      for (const child of iteration.children) await materializeAnatomyNode(child, container, childRun, childOverlayAxis);
    }
    // After the children exist: a hugging auto-layout frame re-measures on every append.
    applyAspectRatio(node, iteration.geometry.aspectRatio, iteration.part, ctx);
  }
}

/** Build a cell's whole anatomy tree inside its root component (the root's own content, then every child). */
async function materializeCellAnatomy(
  root: ComponentNode,
  anatomy: AnatomyNodePlan,
  capability: SlotCapability,
  ctx: RenderContext,
  properties?: PropertyResources,
): Promise<AnatomyRun> {
  const run: AnatomyRun = { root, capability, ctx, deferredOverlay: [], deferredRemoveFromFlow: [], deferredInsetPlacement: [], deferredAbsoluteFill: [], deferredFocusRings: [], properties };
  for (const entry of anatomy.unplaced) if (!ctx.unplacedParts.includes(entry)) ctx.unplacedParts.push(entry);
  await appendAnatomyContent(root, anatomy, run);
  const rootOverlay = root.layoutMode === "NONE" ? overlayMainAxis(anatomy) : undefined;
  for (const child of anatomy.children) await materializeAnatomyNode(child, root, run, rootOverlay);
  return run;
}

/**
 * The icon of a cell with no anatomy tree (the plugin's `variant.icon`): the cell's `iconSvg`, 20px, coloured
 * from the cell's `text` binding; a visible placeholder when it fails to import.
 */
function appendCellIcon(comp: ComponentNode, cell: ResolvedCell, ctx: RenderContext): void {
  const glyph = cell.iconSvg ? createIconFrame(cell.iconSvg) : null;
  if (glyph) {
    glyph.resize(20, 20);
    if (cell.bind.text && !bindIconPaint(glyph, cell.bind.text, ctx.index)) ctx.unresolvedBindings.push(cell.bind.text);
    comp.appendChild(glyph);
  } else {
    ctx.failedIconPaths.push(cell.label);
    comp.appendChild(createIconPlaceholderFrame(20, 20, cell.label));
  }
}

/**
 * A generic, token-bound variant cell built from the plan alone — a padded,
 * radius-bound pill carrying the component name, with fill/stroke/text bound to
 * the cell's tokens. Named with Figma variant syntax (`variant=primary, mode=…`)
 * so `combineAsVariants` derives the variant properties. This is the deterministic
 * baseline; per-archetype fidelity (icon slots) is layered on top.
 *
 * Geometry comes from the artifact: the plan's `baseGeometry`, overlaid with the
 * cell's own `geometry` where it differs (e.g. a size axis). Padding/gap/radius
 * bind to variables and `textStyle` applies the component's own DS type ramp to
 * the label — so sm/md/lg render at genuinely different sizes and the label is
 * not a hardcoded font. The cell's BOX (direction, alignment, declared literal
 * size, per-axis sizing, aspect ratio) is the pure `CellGeometryPlan` from
 * `geometry.ts`, applied in the same order as the Figma plugin's walker
 *: layout + alignment first, literal size and sizing LAST (an explicit
 * size is ignored while an axis is AUTO), aspect ratio after that.
 */
async function createVariantCell(
  plan: ComponentBody,
  cell: ResolvedCell,
  index: number,
  ctx: RenderContext,
  capability: SlotCapability,
  name: string = cell.label,
  properties?: PropertyResources,
): Promise<ComponentNode> {
  const comp = figma.createComponent();
  comp.name = name;
  const box = plan.geometry[index];
  applyCellLayout(comp, box);
  const geom = { ...plan.baseGeometry, ...cell.geometry };
  const gapV = geom.gap ? variableFor(geom.gap, ctx.index) : null;
  for (const [field, side, axis] of [
    ["paddingLeft", geom.paddingLeft, geom.paddingInline],
    ["paddingRight", geom.paddingRight, geom.paddingInline],
    ["paddingTop", geom.paddingTop, geom.paddingBlock],
    ["paddingBottom", geom.paddingBottom, geom.paddingBlock],
  ] as const) {
    const name = side ?? axis;
    const variable = name ? variableFor(name, ctx.index) : null;
    if (variable) comp.setBoundVariable(field, variable);
  }
  if (gapV) comp.setBoundVariable("itemSpacing", gapV);
  // The root's own size limits, clipping and wrapping, as the plugin applies them on the variant root.
  applyLayoutExtras(comp, geom as LayoutExtrasGeometry, box.label, ctx);
  const radius = geom.radius ?? plan.radiusVar;
  if (radius) bindAllRadii(comp, radius, ctx.index);
  if (cell.bind.fill) bindFill(comp, cell.bind.fill, ctx.index, cell.bind.fillOpacity);
  else comp.fills = []; // stroke-only variants are transparent
  if (cell.bind.stroke) bindStroke(comp, cell.bind.stroke, ctx.index, 1, cell.bind.strokeOpacity);
  // The root's border width, opacity (what makes a disabled cell read as disabled) and effect
  // style, as the plugin binds them on the variant root.
  bindFrameField(comp, "strokeWeight", geom.borderWidth, ctx);
  // A CSS border is part of the box: the stroke counts toward the width an auto-layout frame hugs to.
  if (geom.borderWidth !== undefined) {
    (comp as unknown as { strokesIncludedInLayout: boolean }).strokesIncludedInLayout = true;
  }
  bindSideStrokeWeights(comp, geom, ctx);
  bindFrameField(comp, "opacity", geom.opacity, ctx);
  if (cell.bind.effectStyle) await applyEffectStyle(comp, cell.bind.effectStyle, ctx);
  // The cell's content: the contract's anatomy tree (nested parts, native slots, composed
  // children) when it declares one for this cell — else the generic label, as the plugin does.
  const anatomy = plan.cellAnatomy[index];
  let run: AnatomyRun | undefined;
  if (anatomy) {
    run = await materializeCellAnatomy(comp, anatomy, capability, ctx, properties);
  } else {
    // The plugin's label: the DS default font at Figma's own size, styled below. No invented
    // weight or size: the text style or the bound typography is what sizes it.
    await figma.loadFontAsync({ family: FONT_FAMILY_FALLBACK, style: "Regular" });
    const label = figma.createText();
    label.fontName = { family: FONT_FAMILY_FALLBACK, style: "Regular" };
    label.characters = plan.component;
    // Apply the component's own DS type ramp to the label, bound by name like every
    // other token. Falls back to the raw font when the file lacks the style.
    if (geom.textStyle) {
      const styleId = textStyleFor(geom.textStyle, ctx.textStyles);
      if (styleId) {
        // Load the style's font before it re-fonts the label: everything after this
        // (the text-colour bind, `appendChild`) writes to a node carrying that font.
        await loadTextStyleFont(styleId);
        await label.setTextStyleIdAsync(styleId);
      } else bindTypography(label, geom, ctx);
    } else {
      bindTypography(label, geom, ctx);
    }
    if (cell.bind.text) bindTextColor(label, cell.bind.text, ctx.index);
    comp.appendChild(label);
    if (cell.iconSvg) appendCellIcon(comp, cell, ctx);
  }
  // LAST: an explicit size is ignored while the axis is AUTO, so the box is applied
  // after the children exist and the layout modes are set (see `applyCellBox`).
  applyCellBox(comp, box, ctx);
  // Then the overlay children and the out-of-flow children (in the plugin's order): the root's
  // final box is what they align against.
  if (run) {
    applyDeferredAbsoluteFill(run);
    applyDeferredOverlayAlignment(run);
    applyDeferredInsetPlacement(run);
    applyDeferredRemoveFromFlow(run);
    applyDeferredFocusRings(run);
  }
  return comp;
}


// ---------- Window-placed components ----------
//
// Mirrors the plugin's `materializePopupHost` / `beginViewportFrame` / `finishViewportFrame`
// The plan (`viewport.ts`) says WHAT; this only
// carries it out, and reports what it cannot.

/** Shared-data key stamped on the popup node, under `SHARED_DATA_NAMESPACE`. */
const POPUP_COMPONENT_KEY = "popup";

/** Bind one frame field to a variable by name; a missing variable is reported, never a literal. */
/**
 * One-sided borders: bind each declared side's width to `strokeTopWeight` and its siblings. With
 * no uniform border width the sides WITHOUT a border get weight 0 (Figma strokes every side by
 * default, so a bottom-only underline would otherwise draw a full box).
 */
export function bindSideStrokeWeights(
  node: SceneNode,
  g: { borderWidth?: string; borderTopWidth?: string; borderRightWidth?: string; borderBottomWidth?: string; borderLeftWidth?: string },
  ctx: RenderContext,
): void {
  const sides = [
    ["strokeTopWeight", g.borderTopWidth],
    ["strokeRightWeight", g.borderRightWidth],
    ["strokeBottomWeight", g.borderBottomWidth],
    ["strokeLeftWeight", g.borderLeftWidth],
  ] as const;
  if (!sides.some(([, token]) => token)) return;
  if (!("strokeTopWeight" in node)) {
    // Text and ellipses have no individual stroke weights: report, as the plugin does.
    for (const [field, token] of sides) {
      if (token) ctx.refusedSizes.push(`${token} (${field} unsupported on ${node.type.toLowerCase()})`);
    }
    return;
  }
  for (const [field, token] of sides) {
    if (token) {
      const variable = variableFor(token, ctx.index);
      if (variable) {
        try {
          (node as SceneNode & { setBoundVariable(f: VariableBindableNodeField, v: Variable): void }).setBoundVariable(field, variable);
        } catch {
          ctx.unresolvedBindings.push(`${token} (cannot bind ${field} on ${node.type.toLowerCase()})`);
        }
      } else if (!ctx.unresolvedBindings.includes(token)) ctx.unresolvedBindings.push(token);
    } else if (g.borderWidth === undefined) {
      (node as unknown as Record<string, number>)[field] = 0;
    }
  }
}

function bindFrameField(frame: ComponentNode, field: VariableBindableNodeField, token: string | undefined, ctx: RenderContext): void {
  if (!token) return;
  const variable = variableFor(token, ctx.index);
  if (variable) frame.setBoundVariable(field, variable);
  else if (!ctx.unresolvedBindings.includes(token)) ctx.unresolvedBindings.push(token);
}

/**
 * Turn a viewport-set variant's COMPONENT into the viewport stand-in frame and create its backdrop
 * (absolute, behind); the caller appends the popup instance after it. Width binds the existing
 * breakpoint variable; height hugs; each padding side binds the token the CSS margin names.
 */
async function beginViewportFrame(frame: ComponentNode, plan: ViewportFramePlan, ctx: RenderContext): Promise<FrameNode | undefined> {
  frame.layoutMode = "VERTICAL";
  frame.primaryAxisSizingMode = "AUTO";
  frame.counterAxisSizingMode = "FIXED";
  frame.fills = [];
  frame.clipsContent = true;
  // The frame's width is the one binding that must never fall back to an unsized frame: blocking,
  // as in the plugin, even though other missing variables are per-node reports.
  const width = variableFor(plan.width, ctx.index);
  if (!width) throw new Error(`Missing local Figma variables: ${plan.width}`);
  frame.setBoundVariable("width", width);
  bindFrameField(frame, "paddingLeft", plan.padding.left, ctx);
  bindFrameField(frame, "paddingRight", plan.padding.right, ctx);
  bindFrameField(frame, "paddingTop", plan.padding.top, ctx);
  bindFrameField(frame, "paddingBottom", plan.padding.bottom, ctx);
  // Where the popup sits: the declared placement, already turned into alignment by the plan.
  frame.primaryAxisAlignItems = plan.align.primary;
  frame.counterAxisAlignItems = plan.align.counter;
  if (!plan.backdrop) return undefined;
  const backdrop = figma.createFrame();
  backdrop.name = plan.backdrop.part;
  backdrop.fills = [];
  if (plan.backdrop.fill && !bindFill(backdrop, plan.backdrop.fill, ctx.index, plan.backdrop.fillOpacity)) ctx.unresolvedBindings.push(plan.backdrop.fill);
  if (plan.backdrop.stroke && !bindStroke(backdrop, plan.backdrop.stroke, ctx.index, 1, plan.backdrop.strokeOpacity)) ctx.unresolvedBindings.push(plan.backdrop.stroke);
  frame.appendChild(backdrop);
  // `position: fixed; inset: 0` over the window: out of flow, pinned to every edge, so it follows
  // the frame through a web-mode switch and a popup that grows.
  backdrop.layoutPositioning = "ABSOLUTE";
  backdrop.constraints = { horizontal: "STRETCH", vertical: "STRETCH" };
  if (plan.backdrop.effectStyle) await applyEffectStyle(backdrop, plan.backdrop.effectStyle, ctx);
  return backdrop;
}

/**
 * One variant of a viewport set: a host holding an INSTANCE of the matching popup variant, so the
 * popup component stays the single definition Code Connect maps. `context=viewport`: the host is
 * the stand-in frame with the backdrop behind the instance, placed and sized by the frame plan.
 * `context=component`: the instance alone, hugged.
 */
async function createPopupHost(
  name: string,
  popup: ComponentNode,
  popupPart: string,
  frame: ViewportFramePlan | null,
  ctx: RenderContext,
): Promise<ComponentNode> {
  const host = figma.createComponent();
  host.name = name;
  const instance = createInstanceOf(popup);
  // The anatomy root's own name, so overrides made on that layer match by name on a refresh.
  instance.name = popupPart;
  if (!frame) {
    host.layoutMode = "VERTICAL";
    host.primaryAxisSizingMode = "AUTO";
    host.counterAxisSizingMode = "AUTO";
    host.fills = [];
    host.appendChild(instance);
    return host;
  }
  const backdrop = await beginViewportFrame(host, frame, ctx);
  host.appendChild(instance);
  if (frame.popupWidth.mode === "hug") {
    ctx.refusedSizes.push(`${popupPart} width: no build-computed viewport width — popup hugs inside the frame`);
  } else {
    instance.layoutSizingHorizontal = "FILL";
    // The CSS `min()`'s own cap: FILL up to this width.
    if (frame.popupWidth.mode === "capped") instance.maxWidth = frame.popupWidth.maxWidthPx;
  }
  // After the popup is sized, the frame's hugged height is final: pin the backdrop over it.
  if (backdrop) {
    backdrop.x = 0;
    backdrop.y = 0;
    backdrop.resize(host.width, host.height);
  }
  return host;
}

/** Lay cells out on a grid by their REAL sizes (overlapping variants would hide their geometry), then combine. */
/**
 * Lay the variants out on an `nCols`-wide grid and combine them: the plugin's
 * `combineVariantGrid` — each column as wide as its widest cell, each row as tall as its tallest,
 * a 24px gutter, no minimum cell size.
 */
function combineGrid(cells: ComponentNode[], nCols: number, page: PageNode): ComponentSetNode {
  const gap = 24;
  const colWidths = Array.from({ length: nCols }, (_, col) => Math.max(0, ...cells.filter((_, i) => i % nCols === col).map((c) => c.width)));
  const rowHeights: number[] = [];
  cells.forEach((c, i) => {
    const row = Math.floor(i / nCols);
    rowHeights[row] = Math.max(rowHeights[row] ?? 0, c.height);
  });
  cells.forEach((comp, i) => {
    comp.x = colWidths.slice(0, i % nCols).reduce((sum, w) => sum + w + gap, 0);
    comp.y = rowHeights.slice(0, Math.floor(i / nCols)).reduce((sum, h) => sum + h + gap, 0);
  });
  return figma.combineAsVariants(cells, page);
}

/**
 * The popup component, built BEFORE the viewport set from the `context=component` cells
 * (one `COMPONENT` when `context` is the only axis, else a set — Drawer's `side`), stamped with
 * the plugin's popup key. Returns the node and its variants by name.
 */
async function buildPopupComponent(
  plan: ComponentBody,
  popup: NonNullable<ComponentBody["popup"]>,
  ctx: RenderContext,
  page: PageNode,
  capability: SlotCapability,
): Promise<{ node: ComponentNode | ComponentSetNode; variantsByName: Map<string, ComponentNode> }> {
  const cells: ComponentNode[] = [];
  for (const variant of popup.variants) {
    cells.push(await createVariantCell(plan, plan.variantMatrix[variant.cellIndex], variant.cellIndex, ctx, capability, variant.variantName));
  }
  const variantsByName = new Map(cells.map((cell) => [cell.name, cell]));
  let node: ComponentNode | ComponentSetNode;
  if (popup.standalone) {
    [node] = cells;
    page.appendChild(node);
  } else {
    node = combineGrid(cells, cells.length, page);
    node.name = popup.name;
  }
  node.setSharedPluginData(SHARED_DATA_NAMESPACE, POPUP_COMPONENT_KEY, plan.component);
  return { node, variantsByName };
}

/** The component sets built for one component (or one Building Block), with their variants. */
/**
 * What a plan's set entry becomes on the canvas: a COMPONENT_SET, or a plain
 * COMPONENT when the component has no variant axes to combine.
 */
type GeneratedSetNode = ComponentSetNode | ComponentNode;

interface BuiltSets {
  /** Every set by its Figma name, in plan order. */
  sets: Array<{ name: string; node: GeneratedSetNode }>;
  /** Every variant of every set by the cell's full label (a split set's variant names omit the split axes). */
  variantsByLabel: Map<string, ComponentNode>;
  popup?: ComponentNode | ComponentSetNode;
}

/**
 * Build the plan's COMPONENT_SETs: one per `plan.sets` entry (one per split value, or the one set),
 * one cell per variant, grid-positioned, combined into a set and named. Positioning happens BEFORE
 * combineAsVariants (Kumo rule). `icons` holds the private icon components an instance swap
 * defaults to, shared by every set of the component and its Building Blocks.
 *
 * Takes `page` explicitly rather than relying on `figma.currentPage`: this runs
 * inside `renderComponentPlan`, which the SKILL.md usage contract calls once PER
 * COMPONENT in a loop within a single inlined script — `figma.createPage()` does
 * NOT switch `figma.currentPage`, and `figma-use`'s own rule caps a script to at
 * most one `setCurrentPageAsync` call, so the page this set belongs on must be
 * threaded through explicitly instead of read off global page state.
 */
async function buildComponentSets(plan: ComponentBody, ctx: RenderContext, page: PageNode, icons: Map<string, ComponentNode>): Promise<BuiltSets> {
  const built: BuiltSets = { sets: [], variantsByLabel: new Map() };
  if (!plan.variantMatrix.length) return built;
  // Probed once per component, not per variant, so every degraded slot is reported together.
  const capability: SlotCapability = { probed: false, available: false };
  // a window-placed component's popup exists BEFORE its set, so every set variant can instance it;
  // each set variant is then a host (a viewport stand-in frame, or the bare instance).
  const popup = plan.popup ? await buildPopupComponent(plan, plan.popup, ctx, page, capability) : undefined;
  for (const setPlan of plan.sets) {
    const properties: PropertyResources | undefined = setPlan.properties?.length ? { parent: page, bindings: [], icons } : undefined;
    const cells: ComponentNode[] = [];
    for (const { index, variantName } of setPlan.cells) {
      const cell = plan.variantMatrix[index];
      const popupVariant = popup && plan.popup ? popup.variantsByName.get(plan.popupVariants?.[index] ?? "") : undefined;
      if (popup && plan.popup && !popupVariant) {
        throw new Error(`"${plan.component}" variant "${cell.label}" has no matching popup variant — rebuild the artifact.`);
      }
      const comp =
        popupVariant && plan.popup
          ? await createPopupHost(variantName, popupVariant, plan.popup.part, plan.viewport[index], ctx)
          : await createVariantCell(plan, cell, index, ctx, capability, variantName, properties);
      cells.push(comp);
      built.variantsByLabel.set(cell.label, comp);
    }
    // A component with no variant axes has nothing to combine. `combineAsVariants`
    // derives a set's properties from its children's names, so a lone cell named
    // `default` (no `prop=value` pair) yields the invalid variant `"="`: Figma marks
    // the set as having errors, reading `variantGroupProperties` throws, and a later
    // component composing this one finds no `default` variant to instance. Emit the
    // cell as a plain COMPONENT instead — the rule `buildPopupComponent` already
    // follows when `context` is a popup's only axis.
    const loneCell = cells.length === 1 && !setPlan.cells[0]?.variantName.includes("=");
    const set: GeneratedSetNode = loneCell && cells[0] ? cells[0] : combineGrid(cells, setPlan.gridColumns, page);
    set.name = setPlan.name;
    if (properties && set.type === "COMPONENT_SET") applyComponentProperties(set, setPlan.properties ?? [], properties);
    built.sets.push({ name: setPlan.name, node: set });
  }
  ctx.nativeSlotsAvailable = ctx.nativeSlotsAvailable || capability.available;
  if (popup && built.sets[0]) {
    // Beside its viewport set, never over it (the documentation page then moves both into its column).
    const [{ node: set }] = built.sets;
    popup.node.x = set.x + set.width + 80;
    popup.node.y = set.y;
    built.popup = popup.node;
  }
  return built;
}

// ---------- Component page (the documentation page + master set) ----------

export interface RenderContext {
  index: VarIndex;
  /** DS text-style index (from `buildTextStyleIndex()`) — chrome applies the DS type ramp by token name. */
  textStyles: TextStyleIndex;
  /** The file's `theme` variable collection; undefined when the file has none (panels then render in the ambient mode). */
  themeCollection: VariableCollection | undefined;
  /** Reuse this page on update (from the manifest); a fresh page on create. */
  reconcile: ReconcilePlan;
  /**
   * Sizes the run REFUSED (never guessed): axes the artifact marks
   * `unsupported`, a `fill` with no auto-layout parent, an unusable aspect ratio.
   * Start it empty and report it when the run ends; `plan.refusedSizes` is the
   * plan-time subset.
   */
  refusedSizes: string[];
  /** Size variables the file lacks. Non-blocking: a CSS length can name a non-token. */
  unresolvedSizes: string[];
  /** Colour / geometry / effect-style names the anatomy tree bound that the file lacks. The node is left unbound and named here. */
  unresolvedBindings: string[];
  /**
   * Declared slots that fell back to baked, non-swappable content: this Figma build has no
   * `createSlot()`, or it threw for that slot` on a variant
   * inside a `COMPONENT_SET` as the least-proven corner of the API). Reported, never silent.
   */
  degradedSlots: DegradedSlot[];
  /** Whether any component's probe found `createSlot()` in this Figma build. */
  nativeSlotsAvailable: boolean;
  /** Composed-child slots whose default instance could not be created (child not generated yet, or no matching cell). */
  unresolvedComposedChildren: UnresolvedComposedChild[];
  /**
   * Every component generated so far this run, by contract slug → variant label → the
   * variant COMPONENT. `renderComponentPlan` fills it; start it empty. Children generate
   * before their consumers (`generationOrder`), so a consumer finds its children here.
   */
  generated: Map<string, Map<string, ComponentNode>>;
  /**
   * The composed children the current component needs, resolved by `renderComponentPlan`
   * from `generated` (else from the file, so a child built in an earlier script is found):
   * `composedChildKeyOf(slug, label)` → the child's variant COMPONENT. Start it empty.
   */
  composedChildren: Map<string, ComponentNode>;
  /**
   * Composed-child request (`composedChildRequestKey(slot, axisValues)`) → the child's variant label
   * for the current component (`plan.composedChildren`).
   */
  composedChildLabels: Record<string, string | null>;
  /**
   * The current component's Building Blocks, by part: the block's variant matrix and its generated
   * variants by full label. Filled by `renderComponentPlan`; start it unset.
   */
  buildingBlocks?: Map<string, { matrix: ResolvedCell[]; variants: Map<string, ComponentNode> }>;
  /** Placement the skill does not carry out yet: position/length along an OVERLAY parent's main axis. */
  unplacedParts: string[];
  /** Icon parts that failed to materialise (no `iconSvg`, or the SVG import threw); each is a visible placeholder. */
  failedIconPaths: string[];
  /** Image parts whose embedded asset failed to materialise (no `imageData`, empty decode, or an import error); no node is inserted. */
  failedImageAssets: string[];
}

/**
 * Resolve this component's composed children to the child's generated variant
 * COMPONENTs: from `ctx.generated` when the child was built earlier in this script, else
 * from the file (a child generated by an earlier `use_figma` call). A child found in neither
 * stays absent and is reported by `appendAnatomyContent`, never substituted.
 */
async function resolveComposedChildren(plan: ComponentBody, ctx: RenderContext): Promise<void> {
  ctx.composedChildren.clear();
  ctx.composedChildLabels = {};
  const setsByName = new Map<string, GeneratedSetNode | null>();
  for (const child of plan.composedChildren) {
    ctx.composedChildLabels[composedChildRequestKey(child.slot, child.axisValues)] = child.label;
    if (!child.label) continue;
    let variant = ctx.generated.get(child.component)?.get(child.label);
    if (!variant && child.setName && child.variantName) {
      // One document scan per distinct set, however many variants ask for it.
      if (!setsByName.has(child.setName)) setsByName.set(child.setName, await findComponentSetByName(child.setName));
      const set = setsByName.get(child.setName);
      // A bare COMPONENT IS the only variant there is, whatever name the plan asked for.
      variant =
        set?.type === "COMPONENT"
          ? set
          : set?.children.find((node): node is ComponentNode => node.type === "COMPONENT" && node.name === child.variantName);
    }
    if (variant) ctx.composedChildren.set(composedChildKeyOf(child.component, child.label), variant);
  }
}

/**
 * Find a component set anywhere in the document by name — a child this run did not
 * generate itself, built by an earlier `use_figma` call.
 *
 * Loads ONE page at a time (`PageNode.loadAsync()`) instead of `figma.loadAllPagesAsync()`:
 * that API is rejected by several hosts, the Figma MCP `use_figma` runtime among them
 * ("loadAllPagesAsync is not a supported API"), and `figma.root.findOne` needs the whole
 * document loaded before it may run. A page that refuses to load is skipped, so the worst
 * case is no match — which the caller already reports as an unresolved composed child
 * rather than substituting something else. Loading a page is not a page switch, so this
 * keeps the one-`setCurrentPageAsync`-per-script rule intact.
 */
async function findComponentSetByName(name: string): Promise<GeneratedSetNode | null> {
  for (const page of figma.root.children) {
    try {
      await page.loadAsync();
    } catch {
      continue;
    }
    // A zero-axis component is published as a bare COMPONENT, so both types count.
    const match = page.findOne((node) => (node.type === "COMPONENT_SET" || node.type === "COMPONENT") && node.name === name);
    if (match) return match as GeneratedSetNode;
  }
  return null;
}

/**
 * Render one component's documentation page from its plan. Skips when the
 * reconcile action is "skip" (unchanged). Returns the page node id for the
 * manifest. Builds the hidden Building Block sets first (the component's variants instance
 * them), then the component's own sets (one per split value, or one), then lays down the
 * documentation page the plugin renders: Header, Title (description + docs link), Copy me,
 * divider, Variants (a readable slice per theme mode, per set), with the master sets beside it.
 */
export async function renderComponentPlan(plan: ComponentPlan, ctx: RenderContext): Promise<string | null> {
  if (ctx.reconcile.action === "skip") return ctx.reconcile.prev?.nodeId ?? null;

  // Heal text styles FIRST (line-height FLOAT-as-px -> PERCENT). Guarded to run once
  // per inlined script even across a multi-component loop. Without this the page's
  // text-style-bound chrome renders collapsed.
  await applyStyleHeals();

  const page = figma.createPage();
  page.name = plan.page;
  // Switch to the new page BEFORE creating any node. `figma.createComponent()` /
  // `figma.createFrame()` auto-append to `figma.currentPage`; without this the
  // variant cells are built on whatever page was current and `combineAsVariants`
  // then fails/hangs across pages. This is the ONE page switch the script makes
  // (one component = one call = one page — see "Driving use_figma reliably").
  await figma.setCurrentPageAsync(page);

  // One private icon component per icon, shared by every set of the component and its blocks.
  const icons = new Map<string, ComponentNode>();
  // The hidden Building Block sets first: the component's own variants hold instances of them.
  const blocks = new Map<string, GeneratedSetNode>();
  ctx.buildingBlocks = new Map();
  for (const block of plan.buildingBlocks) {
    // A block's composed children are its own requests, resolved before its variants are built.
    await resolveComposedChildren(block, ctx);
    const built = await buildComponentSets(block, ctx, page, icons);
    for (const set of built.sets) blocks.set(set.name, set.node);
    ctx.buildingBlocks.set(block.part, { matrix: block.variantMatrix, variants: built.variantsByLabel });
  }
  // The master sets next: their cells are the previews the page instances (variant-instance nodes).
  await resolveComposedChildren(plan, ctx);
  const built = await buildComponentSets(plan, ctx, page, icons);
  ctx.buildingBlocks = undefined;
  if (built.sets.length === 0) return page.id; // no variants: nothing to document
  // Available to every LATER component's composed-child slots (children generate first).
  ctx.generated.set(plan.slug, built.variantsByLabel);
  const iconComponents = [...icons.values()];
  await renderDocumentationPage(
    plan.documentation,
    {
      componentSet: built.sets[0].node,
      sets: new Map(built.sets.map((set) => [set.name, set.node])),
      blocks,
      variantsByName: built.variantsByLabel,
      ...(built.popup ? { popup: built.popup } : {}),
      icons: new Map(iconComponents.map((icon) => [iconComponentKey(icon), icon])),
    },
    page,
    ctx,
  );
  // Without a documentation page the icons sit beside the set; with one they are already in its
  // definition column.
  placeIconComponents(
    page,
    iconComponents.filter((icon) => icon.parent === page),
  );

  return page.id;
}
