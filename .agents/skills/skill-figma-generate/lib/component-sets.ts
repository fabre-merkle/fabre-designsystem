/**
 * How a contract's output divides into component sets, and what each set is called.
 *
 * A standalone mirror of the generation contract's set rules, the same ones the Figma plugin
 * builds from, copied rather than imported so this skill stays shippable on its own;
 * `tests/component-sets.test.ts` fails when the two drift.
 *
 * - `split` puts one set per value of a primary axis (`Primary Button`, `Secondary Button`);
 * - `shapes` are kinds of the component, each with sets of its own (`Primary Filled Icon Button`);
 * - a Building Block moves a sub-element with its own states into a hidden set
 *   (`.Building Blocks/Select/Item`), nested as an instance in the parent's variants.
 *
 * PURE: no Figma I/O.
 */
import type { ContractAnatomyNode, ContractBuildingBlock, ContractShape, ContractSplit, GenerationContract } from "./artifact";

/** The most variants Figma's library guidance allows in one component set. */
export const MAX_VARIANTS_PER_SET = 30;

/** The hidden prefix of a Building Block set's name. */
export const BUILDING_BLOCKS_PREFIX = ".Building Blocks";

type Axis = { prop: string; values: readonly string[] };

/** `icon-only` becomes `Icon Only`. */
export function titleCaseWords(value: string): string {
  return value
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

/** The Figma name of the set for one value of the split: `Primary Button`, `Primary Filled Button`. */
export function splitSetName(componentName: string, value: string): string {
  return `${titleCaseWords(value)} ${componentName}`;
}

/** The axes a contract splits on, in order. */
export function splitAxesOf(split: ContractSplit): string[] {
  return typeof split.axis === "string" ? [split.axis] : [...split.axis];
}

/** One component set of a contract, with the shape it belongs to and the cells it holds. */
export interface ComponentSetIdentity {
  /** Each split axis's value joined with `-`, in split order, then the shape's slug (`primary-filled-icon`). */
  value: string;
  /** The value of every split axis in this set. */
  key: Record<string, string>;
  /** The shape's name (`Icon`), for a set of a named shape. */
  shape?: string;
  /** The values the shape holds per axis; a cell is in the set only when it is among them. */
  shapeValues?: Record<string, string[]>;
  /** The axes that are no property of this set: its split axes and those its shape fixes. */
  dropped: string[];
  /** The value of every dropped axis in this set. */
  fixed: Record<string, string>;
}

/** The split's sets: the cartesian product of the split axes' values, first axis outermost. */
function splitSetIdentities(split: ContractSplit, axes: readonly Axis[]): Array<{ value: string; key: Record<string, string> }> {
  let sets: Array<Record<string, string>> = [{}];
  for (const prop of splitAxesOf(split)) {
    const axis = axes.find((candidate) => candidate.prop === prop);
    if (!axis) return [];
    sets = sets.flatMap((key) => axis.values.map((value) => ({ ...key, [prop]: value })));
  }
  return sets.map((key) => ({ value: Object.values(key).join("-"), key }));
}

/** The slug a shape's name adds to a set's value: `Icon` is `icon`. */
function shapeSlug(name: string): string {
  return titleCaseWords(name).toLowerCase().replace(/ /g, "-");
}

/**
 * Every component set a contract generates, in order: the split's sets, or with shapes each
 * shape's own sets over the values it holds. Empty for a contract with neither (it has one set),
 * or when a split axis is not among `axes`.
 */
export function componentSetIdentities(contract: { split?: ContractSplit; shapes?: ContractShape[] }, axes: readonly Axis[]): ComponentSetIdentity[] {
  const shapes = contract.shapes?.length ? contract.shapes : undefined;
  if (!shapes) {
    if (!contract.split) return [];
    return splitSetIdentities(contract.split, axes).map((set) => ({ ...set, dropped: Object.keys(set.key), fixed: set.key }));
  }
  return shapes.flatMap((shape) => {
    const split = shape.split ?? contract.split;
    if (!split) return [];
    const held = axes.map((axis) => ({
      prop: axis.prop,
      values: shape.values[axis.prop] ? axis.values.filter((value) => shape.values[axis.prop].includes(value)) : axis.values,
    }));
    const splitAxes = splitAxesOf(split);
    const singles = Object.fromEntries(
      held
        .filter((axis) => axis.values.length === 1 && !splitAxes.includes(axis.prop))
        .filter((axis) => shape.values[axis.prop] !== undefined)
        .map((axis) => [axis.prop, axis.values[0]]),
    );
    return splitSetIdentities(split, held).map((set) => ({
      value: [set.value, ...(shape.name ? [shapeSlug(shape.name)] : [])].join("-"),
      key: set.key,
      ...(shape.name ? { shape: shape.name } : {}),
      shapeValues: shape.values,
      dropped: [...splitAxes, ...Object.keys(singles)],
      fixed: { ...set.key, ...singles },
    }));
  });
}

/** Whether a variant's key belongs to one component set: its split values and its shape's values. */
export function cellInComponentSet(cellKey: Readonly<Record<string, string>>, set: Pick<ComponentSetIdentity, "key" | "shapeValues">): boolean {
  return (
    Object.entries(set.key).every(([prop, value]) => cellKey[prop] === value) &&
    Object.entries(set.shapeValues ?? {}).every(([prop, values]) => values.includes(cellKey[prop]))
  );
}

/** A variant label (`variant=primary, size=sm`) without the entries for each of `axes`. */
export function labelWithoutAxes(label: string, axes: readonly string[]): string {
  return label
    .split(", ")
    .filter((entry) => !axes.some((axis) => entry.startsWith(`${axis}=`)))
    .join(", ");
}

type NamedContract = Pick<GenerationContract, "slug" | "componentName"> & { source?: { slug: string } };

/** `select-item` of `select` is `Item`; a part without the prefix is just title-cased. */
function partMember(contract: NamedContract, part: string): string {
  const prefix = `${contract.source?.slug ?? contract.slug}-`;
  return part.startsWith(prefix) ? part.slice(prefix.length) : part;
}

/** The label a Building Block carries in its set's name. */
export function buildingBlockLabel(contract: NamedContract, block: Pick<ContractBuildingBlock, "part" | "name">): string {
  return block.name ?? titleCaseWords(partMember(contract, block.part));
}

/**
 * The Figma name of a Building Block's set: `.Building Blocks/Select/Item`. One set of a split
 * block is named for its value as a split contract's set is: `.Building Blocks/Tabs/Line Md Tab`.
 */
export function buildingBlockSetName(contract: NamedContract, block: Pick<ContractBuildingBlock, "part" | "name">, splitValue?: string): string {
  const label = buildingBlockLabel(contract, block);
  return `${BUILDING_BLOCKS_PREFIX}/${contract.componentName}/${splitValue === undefined ? label : splitSetName(label, splitValue)}`;
}

/** One hidden set of a Building Block: its name and, for a split block, the set it is. */
export interface BuildingBlockSetIdentity {
  name: string;
  splitValue?: string;
}

/** The hidden sets of one Building Block, in order: one per value of its split, or the one set. */
export function buildingBlockSetIdentities(
  contract: NamedContract,
  block: Pick<ContractBuildingBlock, "part" | "name" | "split">,
  axes: readonly Axis[],
): BuildingBlockSetIdentity[] {
  if (!block.split) return [{ name: buildingBlockSetName(contract, block) }];
  return componentSetIdentities({ split: block.split }, axes).map((set) => ({
    name: buildingBlockSetName(contract, block, set.value),
    splitValue: set.value,
  }));
}

function anatomyNodeOf(node: ContractAnatomyNode | undefined, part: string): ContractAnatomyNode | undefined {
  if (!node) return undefined;
  if (node.part === part) return node;
  for (const child of node.children ?? []) {
    const found = anatomyNodeOf(child, part);
    if (found) return found;
  }
  return undefined;
}

function subtreeParts(node: ContractAnatomyNode, into = new Set<string>()): Set<string> {
  into.add(node.part);
  for (const child of node.children ?? []) subtreeParts(child, into);
  return into;
}

/**
 * The parts each Building Block owns: its own part and every part beneath it. The parent set does
 * not build them (the block does), so their slots and properties belong to the block.
 */
export function buildingBlockParts(contract: Pick<GenerationContract, "anatomy" | "buildingBlocks">): Map<string, Set<string>> {
  const owned = new Map<string, Set<string>>();
  for (const block of contract.buildingBlocks ?? []) {
    const node = anatomyNodeOf(contract.anatomy, block.part);
    if (node) owned.set(block.part, subtreeParts(node));
  }
  return owned;
}

/** Whether a part sits inside one of the contract's Building Blocks. */
export function isInsideBuildingBlock(contract: Pick<GenerationContract, "anatomy" | "buildingBlocks">, part: string): boolean {
  for (const parts of buildingBlockParts(contract).values()) if (parts.has(part)) return true;
  return false;
}

/**
 * The variant of a Building Block an instance in `parentKey`'s variant shows: each block axis takes
 * the parent's value when the parent has an axis of that name, and its own default otherwise.
 */
export function buildingBlockVariantKey(block: Pick<ContractBuildingBlock, "axes">, parentKey: Record<string, string>): Record<string, string> {
  return Object.fromEntries(block.axes.map((axis) => [axis.prop, parentKey[axis.prop] ?? (axis.default as string)]));
}
