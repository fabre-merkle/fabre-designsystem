/**
 * How a contract's output divides into component sets, and what each set is called.
 *
 * Figma's library guidance caps a component set at 30 variants. A contract keeps to the cap in
 * three ways, each declared in the contract and each generated from it, so shared anatomy and
 * bindings stay in step:
 *
 * - `split` puts one set per value of a primary axis (`Primary Button`, `Secondary Button`);
 * - a Building Block (`buildingBlocks`) moves a sub-element with its own states into a hidden set
 *   (`.Building Blocks/Select/Item`) nested as an instance in the parent;
 * - component properties take what is not a visual difference (see `properties.ts`).
 *
 * A set that still exceeds the cap is reported, unless the contract states a reason (`capReason`).
 * Colour is never moved into variable modes: every variant stays a Figma variant, so Code Connect
 * can map every prop.
 *
 * Dependency-free: this module ships inside the scaffolded compiler bundle.
 */
import { type Diagnostic, diagnostic, diagnosticPath } from "./diagnostics";
import type {
  FigmaGenerationContract,
  GenerationContractAnatomyNode,
  GenerationContractBuildingBlock,
  GenerationContractShape,
  GenerationContractSplit,
} from "./types";

/** The most variants Figma's library guidance allows in one component set. */
export const MAX_VARIANTS_PER_SET = 30;

/** The hidden prefix of a Building Block set's name. */
export const BUILDING_BLOCKS_PREFIX = ".Building Blocks";

/** `icon-only` becomes `Icon Only`. */
export function titleCaseWords(value: string): string {
  return value
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * The Figma name of the set for one value of the split: `Primary Button`. A split on several axes
 * joins the values (`primary-filled`), so the set is `Primary Filled Button`.
 */
export function splitSetName(componentName: string, value: string): string {
  return `${titleCaseWords(value)} ${componentName}`;
}

/** The axes a contract splits on, in order: the one `axis`, or each of an `axis` list. */
export function splitAxesOf(split: GenerationContractSplit): string[] {
  return typeof split.axis === "string" ? [split.axis] : [...split.axis];
}

/** One component set of a split: its identity and the axis values that select its variants. */
export interface SplitSetIdentity {
  /** The set's value: each split axis's value joined with `-`, in split order (`primary-filled`). */
  value: string;
  /** The value of every split axis in this set. */
  key: Record<string, string>;
}

/**
 * Every set a split makes, in order: the cartesian product of the split axes' values, with the
 * first axis outermost and each axis's values in the order it declares them. Empty when an axis is
 * not among `axes`.
 */
export function splitSetIdentities(
  split: GenerationContractSplit,
  axes: ReadonlyArray<{ prop: string; values: readonly string[] }>,
): SplitSetIdentity[] {
  let sets: Array<Record<string, string>> = [{}];
  for (const prop of splitAxesOf(split)) {
    const axis = axes.find((candidate) => candidate.prop === prop);
    if (!axis) return [];
    sets = sets.flatMap((key) => axis.values.map((value) => ({ ...key, [prop]: value })));
  }
  return sets.map((key) => ({ value: Object.values(key).join("-"), key }));
}

/** One component set of a contract, with the shape it belongs to and the cells it holds. */
export interface ComponentSetIdentity extends SplitSetIdentity {
  /** The shape's name (`Icon`), for a set of a named shape. */
  shape?: string;
  /** The values the shape holds per axis; a cell is in the set only when it is among them. */
  shapeValues?: Record<string, string[]>;
  /** The axes that are no property of this set: its split axes and those its shape fixes. */
  dropped: string[];
  /** The value of every dropped axis in this set. */
  fixed: Record<string, string>;
}

/** The slug a shape's name adds to a set's value: `Icon` is `icon`. */
function shapeSlug(name: string): string {
  return titleCaseWords(name).toLowerCase().replace(/ /g, "-");
}

/**
 * Every component set a contract generates, in order. Without shapes these are the split's sets
 * (or one set with no identity when there is no split). With shapes each shape makes its own sets:
 * the cartesian product of its split axes over the values the shape holds, named with the shape
 * (`Primary Filled Icon Button`, value `primary-filled-icon`). An axis a shape lists with one
 * value is fixed in its sets. Empty when a split axis is not among `axes`.
 */
export function componentSetIdentities(
  contract: Pick<FigmaGenerationContract, "split" | "shapes">,
  axes: ReadonlyArray<{ prop: string; values: readonly string[] }>,
): ComponentSetIdentity[] {
  const shapes = contract.shapes?.length ? contract.shapes : undefined;
  if (!shapes) {
    if (!contract.split) return [];
    return splitSetIdentities(contract.split, axes).map((set) => ({
      ...set,
      dropped: Object.keys(set.key),
      fixed: set.key,
    }));
  }
  return shapes.flatMap((shape) => {
    const split = shape.split ?? contract.split;
    if (!split) return [];
    const held = axes.map((axis) => ({
      prop: axis.prop,
      values: shape.values[axis.prop]
        ? axis.values.filter((value) => shape.values[axis.prop].includes(value))
        : axis.values,
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
export function cellInComponentSet(
  cellKey: Readonly<Record<string, string>>,
  set: Pick<ComponentSetIdentity, "key" | "shapeValues">,
): boolean {
  return (
    cellInSplitSet(cellKey, set.key) &&
    Object.entries(set.shapeValues ?? {}).every(([prop, values]) => values.includes(cellKey[prop]))
  );
}

/** Whether a variant's key holds the values of one split set. */
export function cellInSplitSet(
  cellKey: Readonly<Record<string, string>>,
  setKey: Readonly<Record<string, string>>,
): boolean {
  return Object.entries(setKey).every(([prop, value]) => cellKey[prop] === value);
}

/** The slug whose name prefixes the parts of a contract: its source component, else itself. */
function partPrefixOf(contract: Pick<FigmaGenerationContract, "slug" | "source">): string {
  return contract.source?.slug ?? contract.slug;
}

/** `select-item` of `select` is `Item`; a part without the prefix is just title-cased. */
function partMember(contract: Pick<FigmaGenerationContract, "slug" | "source">, part: string) {
  const prefix = `${partPrefixOf(contract)}-`;
  return part.startsWith(prefix) ? part.slice(prefix.length) : part;
}

/** The label a Building Block carries in its set's name. */
export function buildingBlockLabel(
  contract: Pick<FigmaGenerationContract, "slug" | "source">,
  block: Pick<GenerationContractBuildingBlock, "part" | "name">,
): string {
  return block.name ?? titleCaseWords(partMember(contract, block.part));
}

/**
 * The Figma name of a Building Block's set: `.Building Blocks/Select/Item`. One set of a split
 * block is named for its value as a split contract's set is: `.Building Blocks/Tabs/Line Md Tab`.
 */
export function buildingBlockSetName(
  contract: Pick<FigmaGenerationContract, "slug" | "source" | "componentName">,
  block: Pick<GenerationContractBuildingBlock, "part" | "name">,
  splitValue?: string,
): string {
  const label = buildingBlockLabel(contract, block);
  return `${BUILDING_BLOCKS_PREFIX}/${contract.componentName}/${
    splitValue === undefined ? label : splitSetName(label, splitValue)
  }`;
}

/** One hidden set of a Building Block: its name and, for a split block, the variants it holds. */
export interface BuildingBlockSetIdentity {
  /** The declared part. */
  part: string;
  /** The set's Figma name. */
  name: string;
  /** The split value, for one set of a split block. */
  splitValue?: string;
  /** The set's identity within the block's split, for a split block. */
  set?: ComponentSetIdentity;
}

/**
 * The hidden sets of one Building Block, in order: one per value of its split, or the one set.
 * `axes` are the block's own (complete) axes, from its compiled contract or its declaration.
 */
export function buildingBlockSetIdentities(
  contract: Pick<FigmaGenerationContract, "slug" | "source" | "componentName">,
  block: Pick<GenerationContractBuildingBlock, "part" | "name" | "split">,
  axes: ReadonlyArray<{ prop: string; values: readonly string[] }>,
): BuildingBlockSetIdentity[] {
  if (!block.split) {
    return [{ part: block.part, name: buildingBlockSetName(contract, block) }];
  }
  return componentSetIdentities({ split: block.split }, axes).map((set) => ({
    part: block.part,
    name: buildingBlockSetName(contract, block, set.value),
    splitValue: set.value,
    set,
  }));
}

/** The code name of a Building Block's part: `SelectItem` for `select-item` of `Select`. */
export function buildingBlockCodeName(
  contract: Pick<FigmaGenerationContract, "slug" | "source" | "componentName">,
  part: string,
): string {
  return `${contract.componentName}${titleCaseWords(partMember(contract, part)).replace(/ /g, "")}`;
}

/** The contract slug of a Building Block, never a real slug (it has a slash). */
export function buildingBlockSlug(
  contract: Pick<FigmaGenerationContract, "slug">,
  part: string,
): string {
  return `${contract.slug}/${part}`;
}

/** A variant label (`variant=primary, size=sm`) without the entry for `axis`. */
export function labelWithoutAxis(label: string, axis: string): string {
  return labelWithoutAxes(label, [axis]);
}

/** A variant label without the entries for each of `axes`. */
export function labelWithoutAxes(label: string, axes: readonly string[]): string {
  return label
    .split(", ")
    .filter((entry) => !axes.some((axis) => entry.startsWith(`${axis}=`)))
    .join(", ");
}

/** One component set a contract generates. */
export interface ComponentSetSummary {
  /** The Figma name of the set. */
  name: string;
  /** The split value (`primary`, or `primary-filled` for several axes), for a set of a split contract. */
  splitValue?: string;
  /** The declared part, for a Building Block set. */
  part?: string;
  /** A Building Block set is hidden from the assets panel. */
  hidden: boolean;
  /** How many variants the set holds. */
  variants: number;
}

export interface SetContract
  extends Pick<
    FigmaGenerationContract,
    "slug" | "source" | "componentName" | "split" | "shapes" | "axes" | "capReason"
  > {
  buildingBlocks?: GenerationContractBuildingBlock[];
}

/** The part of a resolved plan the set counts read. */
export interface SetPlan {
  variantMatrix: ReadonlyArray<{ key: Record<string, string> }>;
}

/**
 * The component sets of a contract's own output, in order: one per value of the split axis, or
 * the one set named for the component. Building Block sets come from `buildingBlockSets`.
 */
export function componentSetSummaries(contract: SetContract, plan: SetPlan): ComponentSetSummary[] {
  if (!contract.split && !contract.shapes?.length) {
    return [{ name: contract.componentName, hidden: false, variants: plan.variantMatrix.length }];
  }
  return componentSetIdentities(contract, contract.axes).map((set) => ({
    name: splitSetName(contract.componentName, set.value),
    splitValue: set.value,
    hidden: false,
    variants: plan.variantMatrix.filter((cell) => cellInComponentSet(cell.key, set)).length,
  }));
}

/** The plan of a compiled Building Block, with the axes its sets are split over. */
export interface SetBlockPlan extends SetPlan {
  variantAxes?: ReadonlyArray<{ prop: string; values: readonly string[] }>;
}

/** The hidden sets of each Building Block, from the compiled blocks: one per split value, or one. */
export function buildingBlockSets(
  contract: SetContract,
  blocks: ReadonlyArray<{ part: string; resolvedPlan: SetBlockPlan }>,
): ComponentSetSummary[] {
  return blocks.flatMap((block) => {
    const declared = contract.buildingBlocks?.find((candidate) => candidate.part === block.part);
    const axes =
      block.resolvedPlan.variantAxes ??
      (declared?.axes as ReadonlyArray<{ prop: string; values: readonly string[] }> | undefined) ??
      [];
    return buildingBlockSetIdentities(contract, declared ?? { part: block.part }, axes).map(
      (identity) => ({
        name: identity.name,
        part: block.part,
        ...(identity.splitValue !== undefined ? { splitValue: identity.splitValue } : {}),
        hidden: true,
        variants: identity.set
          ? block.resolvedPlan.variantMatrix.filter((cell) =>
              cellInComponentSet(cell.key, identity.set as ComponentSetIdentity),
            ).length
          : block.resolvedPlan.variantMatrix.length,
      }),
    );
  });
}

/** Every set a compiled contract generates, with its variant count and whether it is over the cap. */
export interface SetReport extends ComponentSetSummary {
  slug: string;
  /** More variants than `MAX_VARIANTS_PER_SET`. */
  overCap: boolean;
  /** The contract's written reason to exceed the cap, when it declares one. */
  capReason?: string;
}

export function setReports(compiled: {
  contract: SetContract;
  resolvedPlan: SetPlan;
  buildingBlocks?: ReadonlyArray<{ part: string; resolvedPlan: SetBlockPlan }>;
}): SetReport[] {
  const { contract } = compiled;
  return [
    ...componentSetSummaries(contract, compiled.resolvedPlan),
    ...buildingBlockSets(contract, compiled.buildingBlocks ?? []),
  ].map((set) => ({
    ...set,
    slug: contract.slug,
    overCap: set.variants > MAX_VARIANTS_PER_SET,
    ...(contract.capReason ? { capReason: contract.capReason } : {}),
  }));
}

/** The slice of a compiled contract the set reports read. */
export interface ComponentSetSource {
  contract: SetContract;
  resolvedPlan: SetPlan;
  buildingBlocks?: ReadonlyArray<{ part: string; resolvedPlan: SetBlockPlan }>;
}

/**
 * Every component set the contracts generate, with its variant count, in artifact order: one per
 * contract (or one per value of its split axis), then the hidden set of each Building Block.
 */
export function componentSetReports(components: readonly ComponentSetSource[]): SetReport[] {
  return components.flatMap((component) => setReports(component));
}

/**
 * A warning for each set over the cap that its contract gives no reason for. A set whose contract
 * states a `capReason` is allowed: the reason is part of the report, not a warning.
 */
export function variantCapWarnings(components: readonly ComponentSetSource[]): Diagnostic[] {
  return componentSetReports(components)
    .filter((set) => set.overCap && !set.capReason)
    .map((set) =>
      diagnostic(
        "variant-cap-exceeded",
        `"${set.name}" holds ${set.variants} variants, over the ${MAX_VARIANTS_PER_SET} Figma's library guidance allows in one set.`,
        diagnosticPath(set.slug, ["sets", set.name]),
      ),
    );
}

function anatomyNodeOf(
  node: GenerationContractAnatomyNode | undefined,
  part: string,
): GenerationContractAnatomyNode | undefined {
  if (!node) return undefined;
  if (node.part === part) return node;
  for (const child of node.children ?? []) {
    const found = anatomyNodeOf(child, part);
    if (found) return found;
  }
  return undefined;
}

/** The parts of an anatomy subtree: the node's own part and every descendant's. */
function subtreeParts(node: GenerationContractAnatomyNode, into = new Set<string>()): Set<string> {
  into.add(node.part);
  for (const child of node.children ?? []) subtreeParts(child, into);
  return into;
}

/** The anatomy node a Building Block's part names, or undefined when the anatomy lacks it. */
export function buildingBlockNode(
  contract: Pick<FigmaGenerationContract, "anatomy">,
  part: string,
): GenerationContractAnatomyNode | undefined {
  return anatomyNodeOf(contract.anatomy, part);
}

/**
 * The parts each Building Block owns: its own part and every part beneath it. The parent set does
 * not materialize them (the block does), so their slots and properties belong to the block.
 */
export function buildingBlockParts(
  contract: Pick<FigmaGenerationContract, "anatomy" | "buildingBlocks">,
): Map<string, Set<string>> {
  const owned = new Map<string, Set<string>>();
  for (const block of contract.buildingBlocks ?? []) {
    const node = anatomyNodeOf(contract.anatomy, block.part);
    if (node) owned.set(block.part, subtreeParts(node));
  }
  return owned;
}

/** Whether a part sits inside one of the contract's Building Blocks. */
export function isInsideBuildingBlock(
  contract: Pick<FigmaGenerationContract, "anatomy" | "buildingBlocks">,
  part: string,
): boolean {
  for (const parts of buildingBlockParts(contract).values()) if (parts.has(part)) return true;
  return false;
}

/**
 * The variant of a Building Block an instance in `parentKey`'s variant shows: each block axis takes
 * the parent's value when the parent has an axis of that name, and its own default otherwise.
 */
export function buildingBlockVariantKey(
  block: Pick<GenerationContractBuildingBlock, "axes">,
  parentKey: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    block.axes.map((axis) => [axis.prop, parentKey[axis.prop] ?? (axis.default as string)]),
  );
}

/**
 * Every refusal for a contract's `split`, `capReason` and `buildingBlocks`, as readable lines
 * (empty when valid). Run at build time and again when a compiled artifact is loaded, so the two
 * cannot disagree.
 *
 * - A split names a declared axis with at least two values, and the contract has another axis, so
 *   each set still has something to vary. The axis is neither folded into other axes nor read by a
 *   boolean property's `unless`, and the contract has no viewport (a window-placed popup is
 *   generated as a component of its own).
 * - Set names are unique.
 * - A cap reason is not empty.
 * - A Building Block names a declared, non-root part the anatomy renders, outside every other
 *   block, with a part name that starts with the component's name (so Code Connect can name the
 *   member it maps); its root is unconditional; its axes are complete; a parent axis of the same
 *   name has only values the block has. A block's `split` follows a contract's rules over the
 *   block's own axes, and its set names are unique. The block owns its subtree: nothing beneath it
 *   is a composed child or a literal-geometry rule that reads the parent's axes, and a runtime
 *   value of a part it owns has a value in one of the parent's examples.
 */
export function componentSetErrors(contract: FigmaGenerationContract): string[] {
  const errors: string[] = [];
  const at = `"${contract.slug}"`;
  if (contract.capReason !== undefined && !contract.capReason.trim()) {
    errors.push(`${at} declares a capReason that is empty; state why a set may exceed the cap.`);
  }
  const shapes = contract.shapes ?? [];
  const checkSplit = (
    split: GenerationContractSplit,
    held: ReadonlyArray<{ prop: string; values: readonly string[] }>,
    where: string,
    // The axes the split names: the contract's own, or a Building Block's.
    ownAxes: FigmaGenerationContract["axes"] = contract.axes,
    // The properties the sets carry: the contract's own, or those of the parts a block owns.
    ownProperties: NonNullable<FigmaGenerationContract["properties"]> = contract.properties ?? [],
  ) => {
    const splitAxes = splitAxesOf(split);
    const declared = splitAxes.flatMap((prop) => {
      const axis = ownAxes.find((candidate) => candidate.prop === prop);
      if (!axis) errors.push(`${at}${where} splits on undeclared axis "${prop}".`);
      return axis ? [axis] : [];
    });
    if (splitAxes.length === 0) {
      errors.push(`${at}${where} declares a split with no axis; name the axis to split on.`);
    }
    const repeated = splitAxes.filter((prop, index) => splitAxes.indexOf(prop) !== index);
    for (const prop of new Set(repeated)) {
      errors.push(`${at}${where} splits on axis "${prop}" twice.`);
    }
    for (const axis of declared) {
      const prop = axis.prop;
      const values = held.find((candidate) => candidate.prop === prop)?.values ?? axis.values;
      if (values.length < 2) {
        errors.push(
          `${at}${where} splits on axis "${prop}", which has one value; a split makes one set per value, so remove it from \`split\`.`,
        );
      }
      if (axis.foldedValues && Object.keys(axis.foldedValues).length > 0) {
        errors.push(
          `${at}${where} splits on axis "${prop}", which folds values into other axes; the code value of a set would depend on another property.`,
        );
      }
      for (const other of ownAxes) {
        for (const [folded, target] of Object.entries(other.foldedValues ?? {})) {
          if (prop in target) {
            errors.push(
              `${at}${where} splits on axis "${prop}", which axis "${other.prop}" folds "${folded}" into; the code value of a set would depend on another property.`,
            );
          }
        }
      }
      for (const property of ownProperties) {
        if (property.type === "boolean" && property.unless && prop in property.unless) {
          errors.push(
            `${at}${where} splits on axis "${prop}", which boolean property "${property.name}" reads in \`unless\`; a set has no such choice left.`,
          );
        }
      }
    }
    if (declared.length > 0 && ownAxes.length <= declared.length) {
      errors.push(
        `${at}${where} splits on ${declared.length === 1 ? `its only axis "${declared[0].prop}"` : "all of its axes"}; each set would have nothing left to vary. Split on some of the axes, not all.`,
      );
    }
  };
  if (contract.split && shapes.length === 0) {
    checkSplit(contract.split, contract.axes, "");
  }
  if (contract.split && shapes.length > 0) {
    checkSplit(contract.split, contract.axes, "");
  }
  if (contract.split || shapes.length > 0) {
    if (contract.viewport) {
      errors.push(
        `${at} declares a split and a viewport; a window-placed component's popup is a component of its own, so it is not split.`,
      );
    }
  }
  const heldValues = (shape: GenerationContractShape) =>
    contract.axes.map((axis) => ({
      prop: axis.prop,
      values: shape.values[axis.prop]
        ? axis.values.filter((value) => shape.values[axis.prop].includes(value))
        : axis.values,
    }));
  if (shapes.length > 0) {
    const shapeNames = new Set<string>();
    shapes.forEach((shape, index) => {
      const where = ` shape ${shape.name ? `"${shape.name}"` : `#${index + 1}`}`;
      if (shape.name === undefined) {
        if (shapes.findIndex((other) => other.name === undefined) !== index) {
          errors.push(
            `${at} has more than one shape without a name; only one can be the ordinary sets.`,
          );
        }
      } else {
        if (!shape.name.trim() || shape.name.includes("/")) {
          errors.push(`${at}${where} needs a name without a slash.`);
        }
        if (shapeNames.has(shape.name)) errors.push(`${at}${where} is declared twice.`);
        shapeNames.add(shape.name);
      }
      for (const [prop, values] of Object.entries(shape.values)) {
        const axis = contract.axes.find((candidate) => candidate.prop === prop);
        if (!axis) {
          errors.push(`${at}${where} lists undeclared axis "${prop}".`);
          continue;
        }
        for (const value of values) {
          if (!axis.values.includes(value)) {
            errors.push(`${at}${where} lists "${prop}=${value}", not a declared value.`);
          }
        }
      }
      const split = shape.split ?? contract.split;
      if (!split) {
        errors.push(
          `${at}${where} has no split; declare \`split\` on the contract or on the shape.`,
        );
      } else if (shape.split) {
        checkSplit(shape.split, heldValues(shape), where);
        for (const prop of splitAxesOf(shape.split)) {
          if (shape.values[prop]?.length === 1) {
            errors.push(`${at}${where} splits on "${prop}", which it holds one value of.`);
          }
        }
      }
      if (split && !shape.split) {
        for (const prop of splitAxesOf(split)) {
          if (
            (heldValues(shape).find((candidate) => candidate.prop === prop)?.values.length ?? 2) < 2
          ) {
            errors.push(
              `${at}${where} holds one value of split axis "${prop}"; give it a split of its own.`,
            );
          }
        }
      }
      if (
        contract.axes.length -
          Object.keys(shape.values).filter((prop) => shape.values[prop].length === 1).length <=
        (split ? splitAxesOf(split).length : 0)
      ) {
        errors.push(`${at}${where} leaves nothing to vary inside its sets.`);
      }
    });
    // Shapes are kinds of the component: a variant belongs to at most one.
    for (let first = 0; first < shapes.length; first += 1) {
      for (let second = first + 1; second < shapes.length; second += 1) {
        const overlap = contract.axes.every((axis) => {
          const left = shapes[first].values[axis.prop] ?? axis.values;
          const right = shapes[second].values[axis.prop] ?? axis.values;
          return left.some((value) => right.includes(value));
        });
        if (overlap) {
          errors.push(
            `${at} shapes ${shapes[first].name ?? `#${first + 1}`} and ${shapes[second].name ?? `#${second + 1}`} overlap; split them on an axis whose values differ.`,
          );
        }
      }
    }
  }
  if (shapes.length > 0) {
    // An example is a variant a designer copies from the page, so it must be one the sets hold: a
    // variant in no shape is not generated, and its instance would be missing from the page.
    const sets = componentSetIdentities(contract, contract.axes);
    for (const example of contract.documentation?.examples ?? []) {
      const full = contract.axes.every((axis) => axis.prop in example.key);
      if (full && !sets.some((set) => cellInComponentSet(example.key, set))) {
        errors.push(
          `${at} example "${example.label}" is a variant no shape holds, so no set generates it; change its key to a variant of a shape.`,
        );
      }
    }
  }
  if (contract.split || shapes.length > 0) {
    const names = new Map<string, string>();
    for (const set of componentSetIdentities(contract, contract.axes)) {
      const name = splitSetName(contract.componentName, set.value);
      const clash = names.get(name);
      if (clash) {
        errors.push(`${at} split values "${clash}" and "${set.value}" name one set.`);
      }
      names.set(name, set.value);
    }
  }

  const blocks = contract.buildingBlocks ?? [];
  if (blocks.length === 0) return errors;
  if (contract.viewport) {
    errors.push(`${at} declares Building Blocks and a viewport, which is not supported.`);
  }
  const owned = buildingBlockParts(contract);
  const seenParts = new Set<string>();
  const labels = new Map<string, string>();
  const prefix = `${partPrefixOf(contract)}-`;
  for (const block of blocks) {
    const where = `${at} Building Block "${block.part}"`;
    if (seenParts.has(block.part)) {
      errors.push(`${where} is declared twice.`);
      continue;
    }
    seenParts.add(block.part);
    if (block.part === contract.rootPart) {
      errors.push(`${where} is the root part; a block is a sub-element of the component.`);
      continue;
    }
    if (!contract.parts.includes(block.part)) {
      errors.push(`${where} references an undeclared part.`);
      continue;
    }
    const node = anatomyNodeOf(contract.anatomy, block.part);
    if (!node) {
      errors.push(`${where} references a part the anatomy does not render.`);
      continue;
    }
    if (!block.part.startsWith(prefix) || block.part.length === prefix.length) {
      errors.push(
        `${where} must be named "${prefix}<name>", so Code Connect can name the member it maps.`,
      );
    }
    const label = buildingBlockLabel(contract, block);
    if (!label.trim() || label.includes("/")) {
      errors.push(`${where} needs a name without a slash.`);
    }
    const clash = labels.get(label);
    if (clash) errors.push(`${where} has the same name as Building Block "${clash}".`);
    labels.set(label, block.part);
    if (node.when || node.unless) {
      errors.push(
        `${where} is rendered conditionally; a block's root is always shown, so its anatomy node cannot declare \`when\` or \`unless\`.`,
      );
    }
    for (const [other, parts] of owned) {
      if (other !== block.part && parts.has(block.part)) {
        errors.push(`${where} sits inside Building Block "${other}"; blocks do not nest.`);
      }
    }
    if (block.axes.length === 0) {
      errors.push(
        `${where} declares no axes; a block exists for a sub-element with its own states.`,
      );
    }
    const seenAxes = new Set<string>();
    for (const axis of block.axes) {
      if (seenAxes.has(axis.prop)) errors.push(`${where} declares axis "${axis.prop}" twice.`);
      seenAxes.add(axis.prop);
      if (axis.values === undefined || axis.default === undefined || axis.attribute === undefined) {
        errors.push(
          `${where} axis "${axis.prop}" must declare values, default and attribute; a block's axes all come from the contract.`,
        );
        continue;
      }
      const parentAxis = contract.axes.find((candidate) => candidate.prop === axis.prop);
      const missing = (parentAxis?.values ?? []).filter((value) => !axis.values?.includes(value));
      if (missing.length > 0) {
        errors.push(
          `${where} axis "${axis.prop}" lacks ${missing.map((value) => `"${value}"`).join(", ")}, which the parent axis of the same name has.`,
        );
      }
    }
    const completeAxes = block.axes.filter(
      (axis): axis is FigmaGenerationContract["axes"][number] =>
        axis.values !== undefined && axis.default !== undefined && axis.attribute !== undefined,
    );
    if (block.split && completeAxes.length === block.axes.length) {
      // The block's sets carry only the properties of the parts it owns (`buildingBlockContract`).
      const blockParts = owned.get(block.part) ?? new Set<string>();
      checkSplit(
        block.split,
        completeAxes,
        ` Building Block "${block.part}"`,
        completeAxes,
        (contract.properties ?? []).filter((property) => blockParts.has(property.part)),
      );
      const names = new Map<string, string>();
      for (const set of buildingBlockSetIdentities(contract, block, completeAxes)) {
        const clash = names.get(set.name);
        if (clash) {
          errors.push(`${where} split values "${clash}" and "${set.splitValue}" name one set.`);
        }
        names.set(set.name, set.splitValue ?? "");
      }
    }
    const inside = owned.get(block.part) ?? new Set<string>();
    for (const slot of contract.slots ?? []) {
      if (inside.has(slot.part) && slot.composedChild) {
        errors.push(`${where} owns slot "${slot.name}", which composes a child; not supported.`);
      }
    }
    // A runtime value of a part the block owns is the block's: its one example takes the value
    // the first of the parent's examples that has one gives it.
    for (const declaration of contract.runtimeValues ?? []) {
      if (!inside.has(declaration.part)) continue;
      const given = (contract.documentation?.examples ?? []).some(
        (example) => example.runtimeValues?.[declaration.name] !== undefined,
      );
      if (!given) {
        errors.push(
          `${where} owns the part of runtime value "${declaration.name}", which none of the parent's examples gives a value; give one, so the block's example shows it.`,
        );
      }
    }
    for (const literal of contract.literalGeometry ?? []) {
      if (!inside.has(literal.part)) continue;
      for (const axisProp of Object.keys(literal.when ?? {})) {
        if (!seenAxes.has(axisProp)) {
          errors.push(
            `${where} owns a literal-geometry rule for "${literal.part}" that reads axis "${axisProp}", which the block does not have.`,
          );
        }
      }
    }
    const conditional = (candidate: GenerationContractAnatomyNode): string[] =>
      [
        ...Object.keys(candidate.when ?? {}),
        ...Object.keys(candidate.unless ?? {}),
        ...(candidate.children ?? []).flatMap(conditional),
      ].filter((axisProp) => !seenAxes.has(axisProp));
    for (const axisProp of new Set((node.children ?? []).flatMap(conditional))) {
      errors.push(
        `${where} owns anatomy that reads axis "${axisProp}", which the block does not have.`,
      );
    }
  }
  return errors;
}
