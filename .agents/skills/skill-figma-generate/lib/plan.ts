/**
 * The PURE planner. `(component, artifact, options) → ComponentPlan` — a fully serializable
 * documentation-page plan with NO Figma I/O, NO `Date`/random, NO LLM. The Figma
 * emitter (`emit.ts`, impure, inlined into `use_figma`) walks this plan; only
 * node IDs vary there. Determinism is proven HERE: same inputs → byte-identical
 * plan (see `tests/plan.test.ts`).
 *
 * The input is one entry of the compiled V2 generation artifact
 * (`.agents/figma-generation-contract.json`, read via `artifact.ts`) — the same
 * contract + resolved plan the Figma plugin walks. Nothing here infers
 * component semantics: axes, the variant matrix and its bindings, geometry,
 * parts, slots and anatomy all come from the artifact verbatim — including the documentation page
 * chrome, which is the artifact's closed `documentationTheme` role vocabulary (`documentation-page.ts`,
 * a mirror of the plugin's page plan). The planner adds no design of its own.
 *
 * Geometry is planned in `geometry.ts`: per-cell layout,
 * alignment, declared literal size and sizing mode, mirroring the plugin walker.
 *
 * The anatomy tree (nested parts with their own bindings and geometry, native
 * slots, composed children) is planned in `anatomy.ts`, one tree per variant cell.
 *
 * A window-placed component also gets its viewport stand-in
 * frame per `context=viewport` cell and its popup component, planned in `viewport.ts`.
 *
 * The component sets mirror the plugin's: a `split` (or `shapes`) contract gets one set per split
 * value, named `Primary Button`, with the split axes left out of its variant names; each Building
 * Block gets its own hidden sets (`.Building Blocks/Tabs/Line Horizontal Md Tab`), built from its
 * compiled contract and plan, which the parent's variants instance. The naming rules are mirrored
 * in `component-sets.ts`.
 *
 * Extension seam: further skill-parity work extends THIS function from the same
 * `ArtifactComponent` input — never from a second schema.
 */
import type {
  ArtifactComponent,
  ContractAnatomyNode,
  ContractSlot,
  GenerationArtifact,
  ResolvedCell,
  ResolvedGeometry,
} from "./artifact";
import { type AnatomyNodePlan, type ComposedChildRef, componentAnatomyPlans, composedChildRequestKey, composedChildVariantLabel, walkAnatomy } from "./anatomy";
import {
  buildingBlockSetIdentities,
  cellInComponentSet,
  componentSetIdentities,
  isInsideBuildingBlock,
  labelWithoutAxes,
  splitAxesOf,
  splitSetName,
} from "./component-sets";
import {
  buildDocumentationLayout,
  buildDocumentationPagePlan,
  type DocumentationChromeBindings,
  type DocumentationPagePlan,
} from "./documentation-page";
import { type CellGeometryPlan, componentGeometryPlans } from "./geometry";
import { type PopupComponentPlan, popupComponentPlan, popupVariantsByCell, type ViewportFramePlan, viewportFramePlan } from "./viewport";

/** One component set the plan builds: its name, the variant cells it holds, its grid and properties. */
export interface ComponentSetPlan {
  /** The set's Figma name: the component's, a split set's (`Primary Button`) or a Building Block's. */
  name: string;
  /** The split value, for one set of a split or shaped contract. */
  splitValue?: string;
  /**
   * The set's variants, in matrix order: each cell's index into `variantMatrix` and its Figma variant
   * name. A split set leaves its split axes (and the axes its shape fixes) out of the name, so two
   * sets share names; the cell's full `label` is what tells the variants apart.
   */
  cells: Array<{ index: number; variantName: string }>;
  /**
   * Columns of the set's variant grid: one per value of the standard `state` axis, else the
   * `variant` axis, else the `size` axis, else the second axis — the plugin's rule, over the set's
   * own axes, so both lay the set out alike.
   */
  gridColumns: number;
  /**
   * The component properties added to the set, in contract order. An instance swap carries the
   * icon its default component is made from. A part a Building Block owns has its property on the
   * block; a shape's set leaves out the properties of parts none of its variants render.
   */
  properties?: ComponentPropertyPlan[];
}

/** What every component set of a component, or of one of its Building Blocks, is built from. */
export interface ComponentBody {
  /** Display name (`contract.componentName`); also the component-set name when there is one set. */
  component: string;
  /** Contract slug — the stable identity shared with the plugin. */
  slug: string;
  /** The resolved variant matrix, verbatim from the artifact (stable order). */
  variantMatrix: ResolvedCell[];
  /** Row/column axis labels for the master set's grid. */
  gridLabels: { rows: string[]; cols: string[] } | null;
  /**
   * The component sets, in the plugin's order: one per value of the split (or per shape's split
   * value), else the one set named for the component.
   */
  sets: ComponentSetPlan[];
  /** Non-root parts, in contract order — each is emitted as its own COMPONENT. */
  parts: string[];
  /** Geometry shared by every cell unless the cell carries its own `geometry`. */
  baseGeometry: ResolvedGeometry;
  /**
   * The box decision per variant cell, parallel to `variantMatrix` — layout
   * direction, alignment, declared literal size, per-axis sizing (bind / fill /
   * fixed; `hug` is no instruction) and aspect ratio. See `geometry.ts`.
   */
  geometry: CellGeometryPlan[];
  /**
   * Every axis the artifact marks `unsupported`, as `"<variant> <axis>: <value>"`.
   * REFUSED, never guessed: the emitter leaves the axis hugging and
   * the run reports these. The emitter adds the ones only Figma can decide
   * (`fill` outside an auto-layout parent).
   */
  refusedSizes: string[];
  /**
   * Radius token for variant cells: the component's own radius, or undefined when its CSS sets
   * none. Never the documentation theme's radius role: chrome tokens are for the page, and a
   * component without a radius is square in the plugin too.
   */
  radiusVar?: string;
  /** Contract slots (carried for slot materialization). */
  slots: ContractSlot[];
  /** Contract anatomy tree (carried for anatomy materialization), or null when undeclared. */
  anatomyTree: ContractAnatomyNode | null;
  /**
   * The anatomy tree per variant cell, parallel to `variantMatrix`: nested parts with
   * their own bindings and box, native slots, composed children, Building Block instances and the
   * focus ring layer. `null` where the contract declares no anatomy (or its root excludes this
   * cell) — the cell is then the generic label cell. See `anatomy.ts`.
   */
  cellAnatomy: Array<AnatomyNodePlan | null>;
  /**
   * Slugs of the components this one composes, from its slots' composed
   * children. Each must be generated BEFORE this component (`generationOrder`).
   */
  composes: string[];
  /**
   * Every composed child the variants instance, with the child's variant LABEL it resolves to —
   * the join key to the child's generated variant COMPONENT. A slot whose child follows the
   * parent's variant (`variantKeyFromAxes`) has one entry per child variant its cells ask for.
   * `label` is null when the child is not in `PlanOptions.components`, or no cell matches its
   * variant key: that slot is then reported, never substituted.
   */
  composedChildren: ComposedChildPlan[];
  /**
   * The viewport stand-in frame per variant cell, parallel to `variantMatrix`: set on every `context=viewport` cell of a window-placed component, `null` elsewhere.
   */
  viewport: Array<ViewportFramePlan | null>;
  /**
   * The bare popup as its own component, built from the `context=component` cells BEFORE the
   * set: the Code Connect target. `null` when the contract declares no viewport.
   */
  popup: PopupComponentPlan | null;
  /**
   * Per variant cell, the popup variant (by name) the cell holds an INSTANCE of — every cell of a
   * viewport set does, in both contexts. `null` when the contract declares no viewport.
   */
  popupVariants: string[] | null;
}

/** One Building Block: the part it renders in the parent, and its hidden sets. */
export interface BuildingBlockPlan extends ComponentBody {
  part: string;
}

export interface ComponentPlan extends ComponentBody {
  page: string;
  /**
   * The documentation page, from the artifact's `documentationTheme` + `documentationPage` and the
   * contract's description and examples — the same plan the plugin renders (`documentation-page.ts`).
   * `chrome` maps each closed role to the project variable / text style it binds.
   */
  documentation: {
    chrome: DocumentationChromeBindings;
    /** Theme modes the Variants section renders a panel for, default first. */
    themeModes: string[];
    plan: DocumentationPagePlan;
  };
  /**
   * The Building Blocks, in artifact order: each one's hidden sets are built BEFORE the
   * component's own, so its variants can hold instances of them (`AnatomyNodePlan.buildingBlock`).
   */
  buildingBlocks: BuildingBlockPlan[];
}

/** One component property the set declares, as the contract wrote it. */
export type ComponentPropertyPlan =
  | { type: "text"; name: string; default: string }
  | { type: "boolean"; name: string; default: boolean }
  | { type: "instanceSwap"; name: string; iconName: string; iconSvg?: string };

/** The anatomy node that renders `part`, anywhere in the tree. */
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
 * The set's properties from the contract, with each swap's default icon attached. A property of a
 * part a Building Block owns belongs to the block's set; `rendersPart` leaves out the parts none of
 * a shape's variants render.
 */
function componentPropertyPlans(component: ArtifactComponent, rendersPart?: (part: string) => boolean): ComponentPropertyPlan[] {
  const { contract } = component;
  const owned = (contract.properties ?? []).filter(
    (property) => !isInsideBuildingBlock(contract, property.part) && (rendersPart === undefined || rendersPart(property.part)),
  );
  return owned.flatMap((property): ComponentPropertyPlan[] => {
    if (property.type === "text") return [{ type: "text", name: property.name, default: property.default }];
    if (property.type === "boolean") return [{ type: "boolean", name: property.name, default: property.default }];
    const iconNode = findAnatomyNode(contract.anatomy, property.part) as (ContractAnatomyNode & { iconName?: string; iconSvg?: string }) | undefined;
    if (!iconNode?.iconName) return [];
    return [{ type: "instanceSwap", name: property.name, iconName: iconNode.iconName, ...(iconNode.iconSvg ? { iconSvg: iconNode.iconSvg } : {}) }];
  });
}

export interface ComposedChildPlan {
  slot: string;
  component: ComposedChildRef["component"];
  /** The child's display name. */
  componentName: string | null;
  variantKey?: ComposedChildRef["variantKey"];
  /** The child's axis values the parent's variant selects, for a child that follows it. */
  axisValues?: Record<string, string>;
  label: string | null;
  /**
   * Where the emitter finds the child's variant in the file when an earlier script generated it:
   * the name of the child's set that holds it, and the variant's name in that set.
   */
  setName: string | null;
  variantName: string | null;
}

export interface PlanOptions {
  /**
   * The file's theme-collection mode names, `documentationTheme.defaultMode` first
   * (`orderThemeModes`). Default: just the default mode. The Variants section renders one panel
   * per mode.
   */
  themeModes?: string[];
  /** Components that resolve composed children. Default: every component of the artifact. */
  components?: readonly ArtifactComponent[];
}

/** The plugin's variant-grid column rule (`buildComponentSetNodePlan`'s `gridColumns`), over a set's own axes and values. */
function gridColumnsOf(axes: ArtifactComponent["resolvedPlan"]["variantAxes"]): number {
  // The standard `state` axis is last, so its values run across the columns of the grid.
  const standard = ["default", "hover", "active", "focus-visible", "disabled"];
  const stateAxis = axes.find((axis) => axis.prop === "state" && axis.values.every((value) => standard.includes(value)));
  const columnAxis =
    stateAxis ?? axes.find((axis) => axis.prop === "variant") ?? axes.find((axis) => axis.prop === "size") ?? axes[1];
  return Math.max(1, columnAxis?.values.length ?? 1);
}

/** What the planner reads from the artifact besides the component itself. */
export type PlanArtifact = Pick<GenerationArtifact, "documentationTheme" | "documentationPage" | "components">;

/** Whether a part is rendered anywhere in a cell's anatomy plan. */
function anatomyPlanHasPart(node: AnatomyNodePlan | null | undefined, part: string): boolean {
  if (!node) return false;
  return node.part === part || node.children.some((child) => anatomyPlanHasPart(child, part)) || (node.items ?? []).some((item) => anatomyPlanHasPart(item, part));
}

/**
 * The component sets of a component (or a Building Block), as the plugin's
 * `buildComponentSetNodePlans` makes them: one per value of the split (or per shape's split
 * value), else the one set. `nameOf` names each set from its split value.
 */
function componentSetPlans(
  component: ArtifactComponent,
  cellAnatomy: ReadonlyArray<AnatomyNodePlan | null | undefined>,
  nameOf: (splitValue: string | undefined) => string,
): ComponentSetPlan[] {
  const { contract, resolvedPlan } = component;
  const divided = Boolean(contract.split || contract.shapes?.length);
  const identities = divided ? componentSetIdentities(contract, resolvedPlan.variantAxes) : [];
  if (divided && identities.length === 0) {
    throw new Error(`"${contract.slug}" splits on axis "${splitAxesOf(contract.split ?? { axis: [] }).join('", "')}", which its plan lacks.`);
  }
  return (identities.length > 0 ? identities : [undefined]).map((identity) => {
    const dropped = identity?.dropped;
    const cells = resolvedPlan.variantMatrix.flatMap((cell, index) =>
      identity && !cellInComponentSet(cell.key, identity) ? [] : [{ index, variantName: dropped ? labelWithoutAxes(cell.label, dropped) : cell.label }],
    );
    const rendersPart = contract.shapes?.length ? (part: string) => cells.some((cell) => anatomyPlanHasPart(cellAnatomy[cell.index], part)) : undefined;
    const properties = componentPropertyPlans(component, rendersPart);
    return {
      name: nameOf(identity?.value),
      ...(identity ? { splitValue: identity.value } : {}),
      cells,
      // Over the values the set's cells hold: a shape that keeps two states lays out two columns.
      gridColumns: gridColumnsOf(
        resolvedPlan.variantAxes
          .filter((axis) => !dropped?.includes(axis.prop))
          .map((axis) => ({ ...axis, values: axis.values.filter((value) => cells.some(({ index }) => resolvedPlan.variantMatrix[index].key[axis.prop] === value)) })),
      ),
      ...(properties.length > 0 ? { properties } : {}),
    };
  });
}

/** Where a child's variant of `label` sits among the child's own sets. */
function childVariantLocation(child: ArtifactComponent, label: string): { setName: string; variantName: string } | null {
  const index = child.resolvedPlan.variantMatrix.findIndex((cell) => cell.label === label);
  const sets = componentSetPlans(child, [], (splitValue) => (splitValue === undefined ? child.contract.componentName : splitSetName(child.contract.componentName, splitValue)));
  for (const set of sets) {
    const cell = set.cells.find((candidate) => candidate.index === index);
    if (cell) return { setName: set.name, variantName: cell.variantName };
  }
  return null;
}

/** The composed children the cells instance: one per slot, or per child variant a following slot asks for. */
function composedChildPlans(
  component: ArtifactComponent,
  cellAnatomy: ReadonlyArray<AnatomyNodePlan | null | undefined>,
  components: readonly ArtifactComponent[],
): ComposedChildPlan[] {
  const requested = new Map<string, Array<Record<string, string> | undefined>>();
  for (const tree of cellAnatomy) {
    if (!tree) continue;
    walkAnatomy(tree, (node) => {
      if (!node.slot?.composedChild?.variantKeyFromAxes) return;
      const list = requested.get(node.slot.name) ?? [];
      const key = composedChildRequestKey(node.slot.name, node.slot.composedChildAxisValues);
      if (!list.some((values) => composedChildRequestKey(node.slot?.name ?? "", values) === key)) list.push(node.slot.composedChildAxisValues);
      requested.set(node.slot.name, list);
    });
  }
  return (component.contract.slots ?? []).flatMap((slot) => {
    const ref = slot.composedChild;
    if (!ref) return [];
    const child = components.find((candidate) => candidate.contract.slug === ref.component);
    const requests = ref.variantKeyFromAxes ? (requested.get(slot.name) ?? []) : [undefined];
    return requests.map((axisValues): ComposedChildPlan => {
      const label = child ? (composedChildVariantLabel(child, ref, axisValues) ?? null) : null;
      const location = child && label ? childVariantLocation(child, label) : null;
      return {
        slot: slot.name,
        component: ref.component,
        componentName: child?.contract.componentName ?? null,
        ...(ref.variantKey ? { variantKey: ref.variantKey } : {}),
        ...(axisValues ? { axisValues } : {}),
        label,
        setName: location?.setName ?? null,
        variantName: location?.variantName ?? null,
      };
    });
  });
}

/** Everything a component's (or a Building Block's) sets are built from. */
function componentBody(
  component: ArtifactComponent,
  components: readonly ArtifactComponent[],
  nameOf: (splitValue: string | undefined) => string,
): ComponentBody {
  const { contract, resolvedPlan } = component;
  const geometry = componentGeometryPlans(component);
  const popup = popupComponentPlan(component);
  const cellAnatomy = componentAnatomyPlans(component).map((tree) => tree ?? null);
  return {
    component: contract.componentName,
    slug: contract.slug,
    variantMatrix: resolvedPlan.variantMatrix,
    gridLabels: resolvedPlan.gridLabels,
    sets: componentSetPlans(component, cellAnatomy, nameOf),
    parts: contract.parts.filter((part) => part !== contract.rootPart),
    baseGeometry: resolvedPlan.baseGeometry,
    geometry,
    refusedSizes: geometry.flatMap((cell) => cell.refusals),
    radiusVar: resolvedPlan.baseGeometry.radius,
    slots: contract.slots ?? [],
    anatomyTree: contract.anatomy ?? null,
    cellAnatomy,
    composes: [...new Set((contract.slots ?? []).flatMap((slot) => (slot.composedChild ? [slot.composedChild.component] : [])))],
    composedChildren: composedChildPlans(component, cellAnatomy, components),
    viewport: resolvedPlan.variantMatrix.map((_, index) => viewportFramePlan(component, index) ?? null),
    popup: popup ?? null,
    popupVariants: popupVariantsByCell(component, popup) ?? null,
  };
}

/** PURE. No I/O, no Date/random. Deterministic given (component, artifact, options). */
export function generateComponentPlan(
  component: ArtifactComponent,
  artifact: PlanArtifact,
  options: PlanOptions = {},
): ComponentPlan {
  const { contract } = component;
  const { defaultMode, ...chrome } = artifact.documentationTheme;
  const components = options.components ?? artifact.components;
  const themeModes = options.themeModes && options.themeModes.length > 0 ? options.themeModes : [defaultMode];
  const layout = buildDocumentationLayout(component, themeModes, artifact.documentationPage);

  const buildingBlocks = (component.buildingBlocks ?? []).map((block): BuildingBlockPlan => {
    const declared = contract.buildingBlocks?.find((candidate) => candidate.part === block.part);
    const identities = buildingBlockSetIdentities(contract, declared ?? { part: block.part }, block.resolvedPlan.variantAxes);
    const nameOf = (splitValue: string | undefined) => (identities.find((identity) => identity.splitValue === splitValue) ?? identities[0]).name;
    return { part: block.part, ...componentBody({ contract: block.contract, resolvedPlan: block.resolvedPlan }, components, nameOf) };
  });
  const nameOf = (splitValue: string | undefined) => (splitValue === undefined ? contract.componentName : splitSetName(contract.componentName, splitValue));

  return {
    ...componentBody(component, components, nameOf),
    page: contract.componentName,
    documentation: { chrome, themeModes: layout.themeModes, plan: buildDocumentationPagePlan(layout) },
    buildingBlocks,
  };
}
