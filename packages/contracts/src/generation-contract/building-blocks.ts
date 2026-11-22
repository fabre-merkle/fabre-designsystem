/**
 * Building Blocks: the contract of a hidden set, derived from a declared part of its parent.
 *
 * The block is the part's anatomy subtree over the block's own axes, built from the parent's
 * stylesheet like any other contract. It owns the slots and properties of the parts beneath it, and
 * its one documentation example shows the default state with the copy the parent's examples give
 * the block's slots.
 *
 * Dependency-free: this module ships inside the scaffolded compiler bundle.
 */
import {
  buildingBlockCodeName,
  buildingBlockLabel,
  buildingBlockNode,
  buildingBlockParts,
  buildingBlockSlug,
} from "./component-sets";
import type {
  AuthoredGenerationContract,
  FigmaGenerationContract,
  GenerationContractAnatomyNode,
  GenerationContractBuildingBlock,
} from "./types";

/** The node as one item: the parent's `repeat` and per-item `items` belong to its instances. */
function withoutRepeat(node: GenerationContractAnatomyNode): GenerationContractAnatomyNode {
  const { repeat: _repeat, items: _items, ...rest } = node;
  return rest;
}

/** The authored contract of one Building Block of `parent`, ready for the compiler. */
export function buildingBlockContract(
  parent: FigmaGenerationContract,
  block: GenerationContractBuildingBlock,
): AuthoredGenerationContract {
  const node = buildingBlockNode(parent, block.part);
  const inside = buildingBlockParts(parent).get(block.part);
  if (!node || !inside) {
    throw new Error(
      `"${parent.slug}" Building Block "${block.part}" has no anatomy to build from.`,
    );
  }
  const label = buildingBlockLabel(parent, block);
  const slots = (parent.slots ?? []).filter((slot) => inside.has(slot.part));
  const properties = (parent.properties ?? []).filter((property) => inside.has(property.part));
  const literalGeometry = (parent.literalGeometry ?? []).filter((rule) => inside.has(rule.part));
  const runtimeValues = (parent.runtimeValues ?? []).filter((declaration) =>
    inside.has(declaration.part),
  );
  // The block shows the copy the parent's examples give its slots, the first example that has it.
  const copy: Record<string, string> = {};
  for (const slot of slots) {
    for (const example of parent.documentation.examples) {
      const value = example.slots?.[slot.name];
      if (value !== undefined) {
        copy[slot.name] = value;
        break;
      }
    }
  }
  // ...and the runtime value the first of the parent's examples that declares one gives it.
  const measured: Record<string, string> = {};
  for (const declaration of runtimeValues) {
    for (const example of parent.documentation.examples) {
      const value = example.runtimeValues?.[declaration.name];
      if (value !== undefined) {
        measured[declaration.name] = value;
        break;
      }
    }
  }
  const defaultKey = Object.fromEntries(block.axes.map((axis) => [axis.prop, axis.default ?? ""]));
  return {
    schemaVersion: parent.schemaVersion,
    slug: buildingBlockSlug(parent, block.part),
    componentName: buildingBlockCodeName(parent, block.part),
    // Built from the parent's own stylesheet and source, like a part of another component: the
    // parts of the stylesheet outside the block are not its to declare or omit.
    source: { slug: parent.source?.slug ?? parent.slug },
    rootPart: block.part,
    parts: parent.parts.filter((part) => inside.has(part)),
    // The parent repeats the instance (`repeat`, `items`); the block is one item.
    anatomy: withoutRepeat(node),
    ...(slots.length > 0 ? { slots } : {}),
    ...(properties.length > 0 ? { properties } : {}),
    ...(runtimeValues.length > 0 ? { runtimeValues } : {}),
    axes: block.axes,
    ...(block.split ? { split: block.split } : {}),
    ...(block.focusRing ? { focusRing: block.focusRing } : {}),
    documentation: {
      examples: [
        {
          label,
          key: defaultKey,
          ...(Object.keys(copy).length > 0 ? { slots: copy } : {}),
          ...(Object.keys(measured).length > 0 ? { runtimeValues: measured } : {}),
        },
      ],
    },
    reactToFigmaNotes: [
      block.split
        ? `${label} is generated as a Building Block of ${parent.componentName}: hidden sets over its own states, one for each value of its split, nested as instances in the parent.`
        : `${label} is generated as a Building Block of ${parent.componentName}: a hidden set over its own states, nested as an instance in the parent.`,
    ],
    ...(literalGeometry.length > 0 ? { literalGeometry } : {}),
    ...(parent.omittedParts ? { omittedParts: parent.omittedParts } : {}),
  };
}
