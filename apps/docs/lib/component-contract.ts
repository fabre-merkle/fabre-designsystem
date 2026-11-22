import { readFile, stat } from "node:fs/promises";
import path from "node:path";

/**
 * A component's compiled Figma contract, read from the project's own compiled artifact,
 * `.agents/figma-generation-contract.json`. The compiler writes it, so the section on a component
 * page follows the contract and the component source with no copy to keep in step. A project
 * without the artifact (no contracts compiled yet) shows no contract section.
 *
 * Cells are inline Markdown (backticks for code). The page component and its Markdown form render
 * the same tables from `componentContractView`.
 */

export interface ReferenceTable {
  columns: string[];
  rows: string[][];
}

/** A code span whose fence is longer than any backtick run in `value`, so the value survives intact. */
export const code = (value: string) => {
  const longest = Math.max(0, ...(value.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(longest + 1);
  const pad = longest > 0 || value.startsWith("`") || value.endsWith("`") ? " " : "";
  return `${fence}${pad}${value}${pad}${fence}`;
};

interface CompiledAxis {
  prop: string;
  values: string[];
  default: string;
  attribute: string;
}

interface CompiledSlot {
  name: string;
  part: string;
  required?: boolean;
  composedChild?: { component: string };
}

interface CompiledProperty {
  type: "text" | "boolean" | "instanceSwap";
  name: string;
  part: string;
  /** The text, or whether the part is shown. An instance swap has none: its default is the part's icon. */
  default?: string | boolean;
  codeProp?: string;
  contentPresence?: boolean;
}

interface CompiledAnatomyNode {
  part: string;
  iconName?: string;
  children?: CompiledAnatomyNode[];
}

/** One component set the contract generates, with the variants it holds. */
interface CompiledSet {
  name: string;
  variants: number;
  /** A Building Block's set is hidden from the assets panel. */
  hidden: boolean;
}

/** A kind of the component generated as sets of its own. */
export interface CompiledShape {
  name?: string;
  values: Record<string, string[]>;
  split?: { axis: string | string[] };
}

export interface CompiledContract {
  slug: string;
  /** Set on a part-component contract: the component whose page documents it. */
  source?: { slug: string };
  componentName: string;
  rootPart: string;
  parts: string[];
  axes?: CompiledAxis[];
  slots?: CompiledSlot[];
  properties?: CompiledProperty[];
  anatomy?: CompiledAnatomyNode;
  documentation?: { examples: Array<{ label: string }> };
  reactToFigmaNotes?: string[];
  omittedParts?: Record<string, string | { kind: string; reason: string }>;
  /** One component set per value of this axis, or per combination of several. */
  split?: { axis: string | string[] };
  /** Kinds of the component generated as sets of their own (an icon-only button). */
  shapes?: CompiledShape[];
  /** Why a set may hold more than the 30 variants Figma's library guidance allows. */
  capReason?: string;
  /** Sub-elements with their own states, each generated as a hidden set (or one per split value). */
  buildingBlocks?: Array<{ part: string; name?: string; split?: { axis: string | string[] } }>;
  /** Added when the artifact is read: the sets the contract generates, counted from its plan. */
  sets?: CompiledSet[];
}

/** Figma's library guidance: the most variants one component set should hold. */
const VARIANT_CAP = 30;

export interface CompiledEntry {
  contract: CompiledContract;
  resolvedPlan?: { variantMatrix: Array<{ key: Record<string, string> }> };
  buildingBlocks?: Array<{
    part: string;
    contract?: Pick<CompiledContract, "axes">;
    resolvedPlan: { variantMatrix: Array<{ key?: Record<string, string> }> };
  }>;
}

const titleCase = (value: string) =>
  value
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");

/** One set of a split contract: its value (`primary-filled-icon`), split key and shape's values. */
interface SetIdentity {
  value: string;
  key: Record<string, string>;
  shapeValues: Record<string, string[]>;
}

/** The sets a split, with or without shapes, makes: each shape's split over the values it holds. */
function shapedSets(contract: CompiledContract): SetIdentity[] {
  const axes = contract.axes ?? [];
  const shapes = contract.shapes?.length ? contract.shapes : [{ values: {} } as CompiledShape];
  return shapes.flatMap((shape) => {
    const split = shape.split ?? contract.split;
    if (!split) return [];
    const props = Array.isArray(split.axis) ? split.axis : [split.axis];
    const held = props.flatMap((prop) => {
      const axis = axes.find((candidate) => candidate.prop === prop);
      if (!axis) return [];
      const values = shape.values[prop]
        ? axis.values.filter((value) => shape.values[prop].includes(value))
        : axis.values;
      return [{ prop, values }];
    });
    if (held.length !== props.length) return [];
    // One set per combination of the split axes' values, the first axis outermost.
    const keys = held.reduce<Array<Record<string, string>>>(
      (sets, axis) =>
        sets.flatMap((key) => axis.values.map((value) => ({ ...key, [axis.prop]: value }))),
      [{}],
    );
    return keys.map((key) => ({
      value: [...Object.values(key), ...(shape.name ? [shape.name] : [])].join("-"),
      key,
      shapeValues: shape.values,
    }));
  });
}

/** The sets a compiled entry generates: one per split value or the one set, then each block's. */
export function setsOf(entry: CompiledEntry): CompiledSet[] {
  const { contract } = entry;
  const cells = entry.resolvedPlan?.variantMatrix ?? [];
  const own: CompiledSet[] =
    contract.split || contract.shapes?.length
      ? shapedSets(contract).map((set) => ({
          name: `${titleCase(set.value)} ${contract.componentName}`,
          variants: cells.filter(
            (cell) =>
              Object.entries(set.key).every(([prop, value]) => cell.key[prop] === value) &&
              Object.entries(set.shapeValues).every(([prop, values]) =>
                values.includes(cell.key[prop]),
              ),
          ).length,
          hidden: false,
        }))
      : [{ name: contract.componentName, variants: cells.length, hidden: false }];
  const prefix = `${contract.source?.slug ?? contract.slug}-`;
  const blocks = (entry.buildingBlocks ?? []).flatMap((block): CompiledSet[] => {
    const declared = contract.buildingBlocks?.find((candidate) => candidate.part === block.part);
    const label =
      declared?.name ??
      titleCase(block.part.startsWith(prefix) ? block.part.slice(prefix.length) : block.part);
    const blockCells = block.resolvedPlan.variantMatrix;
    if (!declared?.split) {
      return [
        {
          name: `.Building Blocks/${contract.componentName}/${label}`,
          variants: blockCells.length,
          hidden: true,
        },
      ];
    }
    // A split block has one hidden set per value of its split, named for the value before the label.
    return shapedSets({
      ...contract,
      axes: block.contract?.axes ?? [],
      split: declared.split,
      shapes: undefined,
    }).map((set) => ({
      name: `.Building Blocks/${contract.componentName}/${titleCase(set.value)} ${label}`,
      variants: blockCells.filter((cell) =>
        Object.entries(set.key).every(([prop, value]) => cell.key?.[prop] === value),
      ).length,
      hidden: true,
    }));
  });
  return [...own, ...blocks];
}

const artifactPath = () =>
  path.join(process.cwd(), "..", "..", ".agents", "figma-generation-contract.json");

let cache: { mtimeMs: number; contracts: Promise<Map<string, CompiledContract>> } | undefined;

async function readContracts(): Promise<Map<string, CompiledContract>> {
  const artifact = JSON.parse(await readFile(artifactPath(), "utf8")) as {
    components: CompiledEntry[];
  };
  return new Map(
    artifact.components.map((entry) => [
      entry.contract.slug,
      // The sets are counted only for a contract that made a decision about them.
      entry.contract.split ||
      entry.contract.shapes?.length ||
      entry.contract.buildingBlocks?.length ||
      entry.contract.capReason
        ? { ...entry.contract, sets: setsOf(entry) }
        : entry.contract,
    ]),
  );
}

/**
 * The compiled artifact's contracts by slug. The read is cached per file version: a cheap `stat`
 * on each call reloads it when the artifact changes, so a contract recompiled while the docs server
 * runs shows up. A missing artifact gives an empty map, and a failed read or parse is not cached,
 * so the next call reads again.
 */
export async function compiledContracts(): Promise<Map<string, CompiledContract>> {
  let mtimeMs: number;
  try {
    mtimeMs = (await stat(artifactPath())).mtimeMs;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      cache = undefined;
      return new Map();
    }
    throw error;
  }
  if (cache?.mtimeMs === mtimeMs) return cache.contracts;
  const entry = { mtimeMs, contracts: readContracts() };
  cache = entry;
  try {
    return await entry.contracts;
  } catch (error) {
    if (cache === entry) cache = undefined;
    throw error;
  }
}

/** The icon an instance-swap property defaults to: the `iconName` of the anatomy node for its part. */
function iconNameFor(node: CompiledAnatomyNode | undefined, part: string): string | undefined {
  if (!node) return undefined;
  if (node.part === part) return node.iconName;
  for (const child of node.children ?? []) {
    const found = iconNameFor(child, part);
    if (found) return found;
  }
  return undefined;
}

/**
 * The sets a contract generates, with their variant counts and, for a set over the cap, the
 * contract's reason. Only for a contract that declares a split, Building Blocks or a reason.
 */
export function componentSetsTable(contract: CompiledContract): ReferenceTable | undefined {
  if (!contract.sets) return undefined;
  return {
    columns: ["Set", "Variants", "Note"],
    rows: contract.sets.map((set) => [
      code(set.name),
      String(set.variants),
      [
        set.hidden ? "Hidden Building Block, nested in the component" : "",
        set.variants > VARIANT_CAP
          ? `Over the ${VARIANT_CAP} variants Figma recommends${
              contract.capReason ? `: ${contract.capReason}` : ""
            }`
          : "",
      ]
        .filter(Boolean)
        .join(". "),
    ]),
  };
}

export interface ComponentContractView {
  name: string;
  rootPart: string;
  tables: Array<{ title: string; table: ReferenceTable }>;
  notes: string[];
  /** The example labels, in page order. */
  examples: string[];
}

/** What the compiler resolved for one component, or undefined when it has no contract. */
export async function componentContractView(
  slug: string,
): Promise<ComponentContractView | undefined> {
  const contract = (await compiledContracts()).get(slug);
  if (!contract) return undefined;

  const tables: ComponentContractView["tables"] = [];
  tables.push({
    title: "Parts",
    table: {
      columns: ["Part", "Role"],
      rows: contract.parts.map((part) => [
        code(part),
        part === contract.rootPart ? "Root of the anatomy" : "",
      ]),
    },
  });
  if (contract.axes?.length) {
    tables.push({
      title: "Axes",
      table: {
        columns: ["Axis", "Values", "Default", "Attribute"],
        rows: contract.axes.map((axis) => [
          code(axis.prop),
          axis.values.map(code).join(" "),
          code(axis.default),
          code(axis.attribute),
        ]),
      },
    });
  }
  const sets = componentSetsTable(contract);
  if (sets) tables.push({ title: "Component sets", table: sets });
  if (contract.slots?.length) {
    tables.push({
      title: "Slots",
      table: {
        columns: ["Slot", "Part", "Required", "Default content"],
        rows: contract.slots.map((slot) => [
          code(slot.name),
          code(slot.part),
          slot.required ? "yes" : "",
          slot.composedChild ? `Instance of ${code(slot.composedChild.component)}` : "",
        ]),
      },
    });
  }
  if (contract.properties?.length) {
    tables.push({
      title: "Properties",
      table: {
        columns: ["Property", "Type", "Part", "Default", "Code prop"],
        rows: contract.properties.map((property) => {
          const icon =
            property.type === "instanceSwap"
              ? iconNameFor(contract.anatomy, property.part)
              : undefined;
          const codeProp = property.codeProp
            ? code(property.codeProp)
            : property.contentPresence
              ? "Content is present or absent"
              : "";
          return [
            code(property.name),
            { text: "Text", boolean: "Boolean", instanceSwap: "Instance swap" }[property.type],
            code(property.part),
            property.default !== undefined
              ? code(String(property.default))
              : icon
                ? code(icon)
                : "",
            codeProp,
          ];
        }),
      },
    });
  }
  const omitted = Object.entries(contract.omittedParts ?? {});
  if (omitted.length) {
    tables.push({
      title: "Omitted parts",
      table: {
        columns: ["Part", "Reason"],
        rows: omitted.map(([part, entry]) => [
          code(part),
          typeof entry === "string" ? entry : entry.reason,
        ]),
      },
    });
  }
  return {
    name: contract.componentName,
    rootPart: contract.rootPart,
    tables,
    notes: contract.reactToFigmaNotes ?? [],
    examples: contract.documentation?.examples.map((example) => example.label) ?? [],
  };
}
