/**
 * The documentation page, planned purely.
 *
 * A standalone mirror of the Figma plugin's `documentation-layout.ts`
 * (`buildDocumentationLayout` + `buildDocumentationPagePlan`): one artifact yields the same page
 * anatomy on both sides — Header, Title (description + docs link), Copy me, divider, Variants (a
 * readable slice per theme mode, pinned axes captioned), and the master component set captioned
 * and placed beside the page. It is copied rather than imported so this skill stays shippable on
 * its own; `tests/documentation-page.test.ts` fails when the two drift.
 *
 * Every visual choice is a role from the artifact's closed `documentationTheme` vocabulary — never
 * a literal spacing, font, size or colour. The emitter (`emit.ts`) resolves each role to the
 * project's own variable / text style by name.
 */
import type { ArtifactComponent, DocumentationPage, DocumentationTheme, ResolvedCell, ResolvedPlan } from "./artifact";
import { buildingBlockSetIdentities, cellInComponentSet, componentSetIdentities, MAX_VARIANTS_PER_SET, splitSetName } from "./component-sets";
import { popupComponentName } from "./viewport";

type PlanAxis = ResolvedPlan["variantAxes"][number];

export type DocumentationChromeBindings = Omit<DocumentationTheme, "defaultMode">;

export interface DocumentationPreviewRow {
  label: string;
  cells: ResolvedCell[];
}

export interface DocumentationSliceColumn {
  /** The column axis value; absent when the component has no column axis. */
  label?: string;
  /** One cell per row, top to bottom. */
  cells: ResolvedCell[];
}

/**
 * The readable part of the variant matrix: `columnAxis` x one row axis, every other axis pinned
 * to its declared default. Completeness lives in the master component set, not here.
 */
export interface DocumentationSlice {
  columnAxis?: PlanAxis;
  rowAxis?: PlanAxis;
  /** Axes that offer more than one value but are held at their default, in axis order. */
  pinned: Array<{ prop: string; value: string }>;
  /** Names exactly the pinned axes; absent when nothing is pinned. */
  caption?: string;
  columns: DocumentationSliceColumn[];
}

/** One component set of a split contract, with the readable slice of its own variants. */
export interface DocumentationSetLayout {
  /** The set's Figma name (`Primary Button`). */
  name: string;
  /** The split value the set is for. */
  splitValue: string;
  /** The set's axes: every axis but the split axes, each with only the values the set holds. */
  axes: PlanAxis[];
  slice: DocumentationSlice;
  /** Every variant in the set, including those the slice omits. */
  variantCount: number;
}

/** A Building Block's hidden set, as the page lists it. */
export interface DocumentationBuildingBlock {
  part: string;
  /** The set's Figma name (`.Building Blocks/Select/Item`). */
  name: string;
  variantCount: number;
}

export interface DocumentationLayout {
  componentName: string;
  /** Brand wordmark for the Header; the Header is omitted when absent. */
  brandName?: string;
  description?: string;
  /** Absolute docs URL for the Title's link; the link is omitted when absent. */
  docsUrl?: string;
  /** The contract's curated examples, one row each — the page's Copy-me hero. */
  copyMe: DocumentationPreviewRow[];
  axes: PlanAxis[];
  groupAxis?: PlanAxis;
  columnAxis?: PlanAxis;
  rowAxes: PlanAxis[];
  slice: DocumentationSlice;
  /** Every variant in the master component set, including those the slice omits. */
  variantCount: number;
  themeModes: string[];
  /**
   * The popup component's name, set only for a component with a viewport stand-in frame.
   * The popup is its own component (Code Connect can't map a frame inside a variant), shown beside
   * the set as the node that maps to the React component.
   */
  popupComponent?: string;
  /**
   * One layout per set, only for a split contract. Each set gets its own section on the page and
   * its own definition beside it; the fields above then describe the contract's full matrix.
   */
  sets?: DocumentationSetLayout[];
  /** The hidden sets of the component's Building Blocks, listed beside its own definition. */
  buildingBlocks?: DocumentationBuildingBlock[];
  /** The contract's written reason to exceed the variant cap, when it gives one. */
  capReason?: string;
  /** The icons an instance-swap property defaults to, shown with the definition. */
  placeholderIcons?: { icon: string; properties: string[] }[];
}

export type DocumentationTextStyleRole = "titleStyle" | "bodyStyle" | "captionStyle";
export type DocumentationTextTone = "text" | "textSubtle";
export type DocumentationSurfaceRole = "page" | "section";
export type DocumentationSpacingRole = "rowGap" | "contentGap" | "sectionGap" | "pageGutter";

export type DocumentationPagePlanNode =
  | {
      kind: "stack";
      name: string;
      direction: "HORIZONTAL" | "VERTICAL";
      gap: DocumentationSpacingRole;
      padding?: DocumentationSpacingRole;
      surface?: DocumentationSurfaceRole;
      divider?: true;
      rounded?: true;
      themeMode?: string;
      children: DocumentationPagePlanNode[];
    }
  | {
      kind: "label";
      content: string;
      style: DocumentationTextStyleRole;
      tone?: DocumentationTextTone;
      /** Rendered as a real Figma hyperlink on the text node. */
      href?: string;
    }
  | { kind: "divider" }
  | { kind: "variant-instance"; label: string }
  /** The master set. A split contract has one per set, named by `set`. */
  | { kind: "component-definition"; set?: string }
  /** A Building Block's hidden set, by its declared part and its set's Figma name. */
  | { kind: "building-block-definition"; part: string; name: string }
  /** The popup component a viewport set instances: the Code Connect target. */
  | { kind: "popup-definition" }
  /** The placeholder icon component an instance-swap property defaults to, by icon name. */
  | { kind: "icon-definition"; icon: string };

export interface DocumentationPagePlan {
  root: Extract<DocumentationPagePlanNode, { kind: "stack" }>;
  /**
   * The master component set with its caption. Deliberately NOT a child of `root`: it is placed
   * beside the page, so it can never disturb the page's auto-layout flow.
   */
  definition: Extract<DocumentationPagePlanNode, { kind: "stack" }>;
}

function matchesKey(cell: ResolvedCell, key: Record<string, string>): boolean {
  return Object.entries(key).every(([prop, value]) => cell.key[prop] === value);
}

/** The standard `state` axis: the `state` property with only `default`, `hover`, `active`, `focus-visible` and `disabled`. */
function isStandardStateAxis(axis: PlanAxis): boolean {
  const standard = ["default", "hover", "active", "focus-visible", "disabled"];
  return axis.prop === "state" && axis.values.every((value) => standard.includes(value));
}

function preferredAxis(
  axes: PlanAxis[],
  candidates: readonly string[],
): PlanAxis | undefined {
  return candidates
    .map((prop) => axes.find((axis) => axis.prop === prop && axis.values.length > 1))
    .find((axis): axis is PlanAxis => Boolean(axis));
}

/** Caption naming exactly the pinned axes, e.g. `size: md · availability: enabled`. */
export function pinnedCaption(pinned: Array<{ prop: string; value: string }>): string | undefined {
  return pinned.length > 0
    ? pinned.map(({ prop, value }) => `${prop}: ${value}`).join(" · ")
    : undefined;
}

function buildSlice(
  axes: PlanAxis[],
  variantMatrix: ResolvedCell[],
  groupAxis: PlanAxis | undefined,
  columnAxis: PlanAxis | undefined,
  rowAxes: PlanAxis[],
): DocumentationSlice {
  const rowAxis = groupAxis ?? rowAxes.find((axis) => axis.values.length > 1);
  const swept = new Set([columnAxis?.prop, rowAxis?.prop]);
  const pinnedAxes = axes.filter((axis) => !swept.has(axis.prop));
  const pinnedKey = Object.fromEntries(pinnedAxes.map((axis) => [axis.prop, axis.default]));
  const pinned = pinnedAxes
    .filter((axis) => axis.values.length > 1)
    .map((axis) => ({ prop: axis.prop, value: axis.default }));
  const columnValues = columnAxis?.values ?? [undefined];
  const rowValues = rowAxis?.values ?? [undefined];
  const columns = columnValues.map((columnValue) => ({
    ...(columnValue === undefined ? {} : { label: columnValue }),
    cells: rowValues.flatMap((rowValue) => {
      const key = {
        ...pinnedKey,
        ...(columnAxis && columnValue !== undefined ? { [columnAxis.prop]: columnValue } : {}),
        ...(rowAxis && rowValue !== undefined ? { [rowAxis.prop]: rowValue } : {}),
      };
      const cell = variantMatrix.find((candidate) => matchesKey(candidate, key));
      return cell ? [cell] : [];
    }),
  }));
  return { columnAxis, rowAxis, pinned, caption: pinnedCaption(pinned), columns };
}

/** `${docsBaseUrl}/${slug}`, or undefined when the project configures no docs origin. */
function docsUrlFor(docsBaseUrl: string | undefined, slug: string): string | undefined {
  const base = docsBaseUrl?.trim().replace(/\/+$/, "");
  return base ? `${base}/${slug}` : undefined;
}

/**
 * The documentation contract is deterministic from the component's resolved plan:
 * mode/state form readable sections, variant/size form columns, and remaining
 * axes form rows. This keeps every visible preview tied to a real variant cell.
 */
export function buildDocumentationLayout(
  component: ArtifactComponent,
  themeModes: string[],
  page?: DocumentationPage,
): DocumentationLayout {
  const plan = component.resolvedPlan;

  const axes = plan.variantAxes.filter((axis) => axis.values.length > 0);
  // The standard State axis is the column axis, as in the component set's grid, so it never
  // becomes a section.
  const stateAxis = axes.find((axis) => isStandardStateAxis(axis) && axis.values.length > 1);
  const sectionAxes = axes.filter((axis) => axis !== stateAxis);
  const groupAxis =
    preferredAxis(sectionAxes, ["mode", "state"]) ??
    sectionAxes.find((axis) => axis.values.length > 1);
  const columnAxis =
    stateAxis ??
    preferredAxis(
      axes.filter((axis) => axis.prop !== groupAxis?.prop),
      ["variant", "size", "tone", "intent", "kind"],
    ) ??
    axes.find((axis) => axis.prop !== groupAxis?.prop && axis.values.length > 1);
  const rowAxes = axes.filter(
    (axis) => axis.prop !== groupAxis?.prop && axis.prop !== columnAxis?.prop,
  );
  const { contract } = component;
  const splitSets = contract.split || contract.shapes?.length ? componentSetIdentities(contract, plan.variantAxes) : [];
  const sets =
    splitSets.length > 0
      ? splitSets.map((identity): DocumentationSetLayout => {
          const cells = plan.variantMatrix.filter((cell) => cellInComponentSet(cell.key, identity));
          // A set shows only the values its variants hold (an icon-only set has no text size).
          const setAxes = axes
            .filter((axis) => !identity.dropped.includes(axis.prop))
            .map((axis) => {
              const values = axis.values.filter((value) => cells.some((cell) => cell.key[axis.prop] === value));
              // The slice pins the default, so it must be a value this set holds.
              const fallback = values.includes(axis.default) ? axis.default : values[0];
              return { ...axis, values, default: fallback ?? axis.default };
            });
          const setGroup = preferredAxis(setAxes, ["mode", "state"]) ?? setAxes.find((axis) => axis.values.length > 1);
          const setColumn =
            preferredAxis(
              setAxes.filter((axis) => axis.prop !== setGroup?.prop),
              ["variant", "size", "tone", "intent", "kind"],
            ) ?? setAxes.find((axis) => axis.prop !== setGroup?.prop && axis.values.length > 1);
          const setRows = setAxes.filter((axis) => axis.prop !== setGroup?.prop && axis.prop !== setColumn?.prop);
          return {
            name: splitSetName(contract.componentName, identity.value),
            splitValue: identity.value,
            axes: setAxes,
            slice: buildSlice(setAxes, cells, setGroup, setColumn, setRows),
            variantCount: cells.length,
          };
        })
      : undefined;
  // One entry per hidden set: a split block lists each of its sets.
  const buildingBlocks = (component.buildingBlocks ?? []).flatMap((block): DocumentationBuildingBlock[] => {
    const declared = contract.buildingBlocks?.find((candidate) => candidate.part === block.part);
    const blockSets = declared?.split ? componentSetIdentities({ split: declared.split }, block.resolvedPlan.variantAxes) : [];
    return buildingBlockSetIdentities(contract, declared ?? { part: block.part }, block.resolvedPlan.variantAxes).map((identity) => {
      const set = blockSets.find((candidate) => candidate.value === identity.splitValue);
      return {
        part: block.part,
        name: identity.name,
        variantCount: set ? block.resolvedPlan.variantMatrix.filter((cell) => cellInComponentSet(cell.key, set)).length : block.resolvedPlan.variantMatrix.length,
      };
    });
  });
  const copyMe = component.contract.documentation.examples.flatMap((example) => {
    const cell = plan.variantMatrix.find((candidate) => matchesKey(candidate, example.key));
    return cell ? [{ label: example.label, cells: [cell] }] : [];
  });

  const placeholderIcons = instanceSwapIcons(component.contract);
  return {
    componentName: component.contract.componentName,
    brandName: page?.brandName,
    description: component.contract.description,
    docsUrl: docsUrlFor(page?.docsBaseUrl, component.contract.slug),
    copyMe,
    axes,
    groupAxis,
    columnAxis,
    rowAxes,
    slice: buildSlice(axes, plan.variantMatrix, groupAxis, columnAxis, rowAxes),
    variantCount: plan.variantMatrix.length,
    themeModes: themeModes.length > 0 ? themeModes : ["Default"],
    ...(component.contract.viewport ? { popupComponent: popupComponentName(component.contract.componentName) } : {}),
    ...(sets ? { sets } : {}),
    ...(buildingBlocks.length > 0 ? { buildingBlocks } : {}),
    ...(contract.capReason ? { capReason: contract.capReason } : {}),
    ...(placeholderIcons.length > 0 ? { placeholderIcons } : {}),
  };
}

/** The default icon of each instance-swap property, once per icon, with the properties it serves. */
function instanceSwapIcons(contract: ArtifactComponent["contract"]): { icon: string; properties: string[] }[] {
  if (!contract.anatomy) return [];
  const iconsByPart = new Map<string, string>();
  const visit = (node: { part: string; iconName?: string; children?: readonly unknown[] }) => {
    if (node.iconName && !iconsByPart.has(node.part)) iconsByPart.set(node.part, node.iconName);
    for (const child of node.children ?? []) visit(child as typeof node);
  };
  visit(contract.anatomy);
  const icons = new Map<string, string[]>();
  for (const property of contract.properties ?? []) {
    const icon = property.type === "instanceSwap" ? iconsByPart.get(property.part) : undefined;
    if (icon) icons.set(icon, [...(icons.get(icon) ?? []), property.name]);
  }
  return [...icons].map(([icon, properties]) => ({ icon, properties }));
}

function label(
  content: string,
  style: DocumentationTextStyleRole,
  tone: DocumentationTextTone = "text",
  href?: string,
): DocumentationPagePlanNode {
  return { kind: "label", content, style, tone, ...(href ? { href } : {}) };
}

type PageSection = DocumentationPagePlanNode;

function section(
  name: string,
  children: DocumentationPagePlanNode[],
  gap: DocumentationSpacingRole = "contentGap",
): PageSection {
  return { kind: "stack", name, direction: "VERTICAL", gap, children };
}

/** Brand wordmark. Omitted entirely when the project configures none. */
function headerSection(layout: DocumentationLayout): PageSection[] {
  return layout.brandName ? [section("Header", [label(layout.brandName, "bodyStyle")])] : [];
}

/** Title, then description and docs link — each omitted when its data is absent. */
function titleSection(layout: DocumentationLayout): PageSection[] {
  return [
    section(
      "Title",
      [
        label(layout.componentName, "titleStyle"),
        ...(layout.description ? [label(layout.description, "bodyStyle")] : []),
        ...(layout.docsUrl
          ? [label("Documentation", "captionStyle", "textSubtle", layout.docsUrl)]
          : []),
      ],
      "rowGap",
    ),
  ];
}

/** The hero: real component instances, one labelled row per curated contract example. */
function copyMeSection(layout: DocumentationLayout): PageSection[] {
  if (layout.copyMe.length === 0) return [];
  const badge: PageSection = {
    kind: "stack",
    name: "Copy me badge",
    direction: "HORIZONTAL",
    gap: "rowGap",
    padding: "rowGap",
    surface: "section",
    rounded: true,
    children: [label("Copy me", "captionStyle")],
  };
  return [
    section("Copy me", [
      badge,
      ...layout.copyMe.flatMap((row) =>
        row.cells.map((cell) => ({
          kind: "stack" as const,
          name: row.label,
          direction: "HORIZONTAL" as const,
          gap: "contentGap" as const,
          padding: "contentGap" as const,
          surface: "section" as const,
          rounded: true as const,
          children: [
            label(row.label, "captionStyle", "textSubtle"),
            { kind: "variant-instance" as const, label: cell.label },
          ],
        })),
      ),
    ]),
  ];
}

function sliceGrid(slice: DocumentationSlice): PageSection {
  const rowLabels: PageSection[] = slice.rowAxis
    ? [
        {
          kind: "stack",
          name: "Row labels",
          direction: "VERTICAL",
          gap: "contentGap",
          children: [
            label(slice.rowAxis.prop, "captionStyle", "textSubtle"),
            ...slice.rowAxis.values.map((value) => label(value, "captionStyle", "textSubtle")),
          ],
        },
      ]
    : [];
  const columns: PageSection[] = slice.columns.map((column) => ({
    kind: "stack",
    name: column.label ?? "Variants",
    direction: "VERTICAL",
    gap: "contentGap",
    children: [
      ...(column.label ? [label(column.label, "captionStyle", "textSubtle")] : []),
      ...column.cells.map((cell) => ({
        kind: "stack" as const,
        name: cell.label,
        direction: "VERTICAL" as const,
        gap: "rowGap" as const,
        padding: "contentGap" as const,
        children: [{ kind: "variant-instance" as const, label: cell.label }],
      })),
    ],
  }));
  return {
    kind: "stack",
    name: "Variants grid",
    direction: "HORIZONTAL",
    gap: "contentGap",
    children: [...rowLabels, ...columns],
  };
}

/**
 * A readable 2-axis slice per theme mode, stacked vertically, with a caption naming the pinned
 * axes so the page never implies it shows every variant.
 */
function variantsSection(
  layout: DocumentationLayout,
  slice: DocumentationSlice = layout.slice,
  /** The set the section is for, in a split contract. */
  setName?: string,
): PageSection[] {
  return [
    section(setName ? `${setName} variants` : "Variants", [
      label(setName ?? "Variants", "bodyStyle"),
      ...(slice.caption ? [label(slice.caption, "captionStyle", "textSubtle")] : []),
      {
        kind: "stack",
        name: "Variants themes",
        direction: "VERTICAL",
        gap: "contentGap",
        children: layout.themeModes.map((themeMode) => ({
          kind: "stack" as const,
          name: `${themeMode} variants`,
          direction: "VERTICAL" as const,
          gap: "contentGap" as const,
          padding: "contentGap" as const,
          // Opaque, in the panel's own mode: `section` is a translucent recessed fill, which would
          // show the page (in another mode) through a panel that switches mode.
          surface: "page" as const,
          divider: true as const,
          rounded: true as const,
          themeMode,
          children: [label(themeMode, "bodyStyle"), sliceGrid(slice)],
        })),
      },
    ]),
  ];
}

/**
 * The popup component, captioned as what Code Connect maps to the React component. Only for
 * a component with a viewport stand-in frame; it heads the definition column, above the set whose
 * variants instance it.
 */
function popupDefinition(layout: DocumentationLayout): PageSection[] {
  if (!layout.popupComponent) return [];
  return [
    label("Popup component", "bodyStyle"),
    label(
      `${layout.popupComponent} is the component Code Connect maps to the React ${layout.componentName}. Every variant of the set below holds an instance of it.`,
      "captionStyle",
      "textSubtle",
    ),
    { kind: "popup-definition" },
  ];
}

/** The cap warning shown beside a set that exceeds it, with the contract's reason. */
function capCaption(layout: DocumentationLayout, variantCount: number): string {
  return layout.capReason && variantCount > MAX_VARIANTS_PER_SET
    ? ` It is over the ${MAX_VARIANTS_PER_SET} variants Figma recommends for one set: ${layout.capReason}`
    : "";
}

/** One master set, captioned as the thing to instance from. */
function setDefinition(layout: DocumentationLayout, heading: string, variantCount: number, node: DocumentationPagePlanNode): PageSection[] {
  return [
    label(heading, "bodyStyle"),
    label(
      `Instance from this set. It holds all ${variantCount} variants, including those the slice omits.${capCaption(layout, variantCount)}`,
      "captionStyle",
      "textSubtle",
    ),
    node,
  ];
}

/** The Building Blocks, captioned as hidden sets nested in the component. */
function buildingBlockDefinitions(layout: DocumentationLayout): PageSection[] {
  if (!layout.buildingBlocks?.length) return [];
  return [
    label("Building Blocks", "bodyStyle"),
    label(
      `Hidden sets nested in ${layout.componentName} as instances. Each holds the states of one sub-element.`,
      "captionStyle",
      "textSubtle",
    ),
    ...layout.buildingBlocks.flatMap((block) => [
      label(`${block.name} (${block.variantCount} variants)`, "captionStyle", "textSubtle"),
      { kind: "building-block-definition" as const, part: block.part, name: block.name },
    ]),
  ];
}

/** The master set (one per value of a split), captioned as the thing to instance from. Placed beside the page, not in it. */
function definitionSection(layout: DocumentationLayout): PageSection {
  const sets = layout.sets
    ? layout.sets.flatMap((set) => setDefinition(layout, set.name, set.variantCount, { kind: "component-definition", set: set.name }))
    : setDefinition(layout, "Component definition", layout.variantCount, { kind: "component-definition" });
  return section("Component definition", [
    ...popupDefinition(layout),
    ...sets,
    ...buildingBlockDefinitions(layout),
    ...placeholderIconDefinitions(layout),
  ]);
}

/**
 * The definition column without the placeholder icons that were not built (an icon whose SVG failed
 * to import, already reported as a failed icon), each with its heading and caption.
 */
export function withoutMissingIcons(
  definition: Extract<DocumentationPagePlanNode, { kind: "stack" }>,
  built: ReadonlySet<string>,
): Extract<DocumentationPagePlanNode, { kind: "stack" }> {
  const children = definition.children;
  // Each icon is the third node of its heading, caption, icon group.
  const dropped = new Set(
    children.flatMap((child, index) =>
      child.kind === "icon-definition" && !built.has(child.icon) ? [index - 2, index - 1, index] : [],
    ),
  );
  return { ...definition, children: children.filter((_, index) => !dropped.has(index)) };
}

/** The placeholder icons an instance swap defaults to, captioned so a designer knows to swap them. */
function placeholderIconDefinitions(layout: DocumentationLayout): PageSection[] {
  if (!layout.placeholderIcons?.length) return [];
  return layout.placeholderIcons.flatMap(({ icon, properties }) => [
    label("Placeholder icon", "bodyStyle"),
    label(
      `The default for the ${properties.join(" and ")} property. Swap it on an instance for an icon from your library.`,
      "captionStyle",
      "textSubtle",
    ),
    { kind: "icon-definition" as const, icon },
  ]);
}

/**
 * Serialize documentation chrome before touching the Figma API. Every visual
 * choice is a closed theme role, making the plan testable without a canvas.
 * Anatomy, in order: Header, Title, Copy me, divider, Variants. The component definition is a
 * separate root, positioned beside the page by the renderer.
 */
export function buildDocumentationPagePlan(layout: DocumentationLayout): DocumentationPagePlan {
  return {
    root: {
      kind: "stack",
      name: "Documentation",
      direction: "VERTICAL",
      gap: "sectionGap",
      padding: "pageGutter",
      surface: "page",
      rounded: true,
      children: [
        ...headerSection(layout),
        ...titleSection(layout),
        ...copyMeSection(layout),
        { kind: "divider" },
        ...(layout.sets ? layout.sets.flatMap((set) => variantsSection(layout, set.slice, set.name)) : variantsSection(layout)),
      ],
    },
    definition: definitionSection(layout) as DocumentationPagePlan["definition"],
  };
}

/**
 * Order the file's `theme` collection mode names with `documentationTheme.defaultMode` first
 * (case-insensitive: the contract says `"Light"`, a synced file may say `"light"`). Pass the
 * result as `PlanOptions.themeModes`. Mirrors the plugin's `resolveThemeModes` ordering.
 */
export function orderThemeModes(modeNames: readonly string[], defaultMode: string | undefined): string[] {
  if (!defaultMode) return [...modeNames];
  const index = modeNames.findIndex((name) => name.toLowerCase() === defaultMode.toLowerCase());
  if (index <= 0) return [...modeNames];
  const ordered = [...modeNames];
  const [match] = ordered.splice(index, 1);
  ordered.unshift(match);
  return ordered;
}
