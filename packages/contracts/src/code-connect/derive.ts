import type {
  AnatomyOrder,
  CodeConnectMapping,
  CodeProps,
  ComponentContract,
  ContractAxis,
  FigmaManifestComponent,
  PropMapping,
  ShownIn,
  UnmappedProperty,
} from "./types";

/** The design-only axis that switches between a viewport stand-in frame and its bare popup. */
const VIEWPORT_CONTEXT_AXIS = "context";

/** camelCase a slot name (`info-icon`) into a template local (`infoIcon`). */
function localName(name: string): string {
  return name.replace(/[-_ ]+([a-zA-Z0-9])/g, (_, c: string) => c.toUpperCase());
}

/** The anatomy node that renders `part`. */
function anatomyNodeOf(node: AnatomyOrder | undefined, part: string): AnatomyOrder | undefined {
  if (!node) return undefined;
  if (node.part === part) return node;
  for (const child of node.children ?? []) {
    const found = anatomyNodeOf(child, part);
    if (found) return found;
  }
  return undefined;
}

/**
 * The split axes and the values one set of a split component is fixed to (`variant=primary` and
 * `mode=filled` in the `primary-filled` set), and the set's id (that joined value).
 */
export interface FixedAxis {
  values: Record<string, string>;
  id: string;
}

/**
 * Evaluates a `when` or `unless` against the axes a set is fixed to. `never` means the match
 * can no longer hold in this set; `rest` is what still depends on other axes (the fixed axes are
 * dropped, because their values are known).
 */
function againstFixed(
  match: Record<string, string | string[]> | undefined,
  fixed: FixedAxis | undefined,
): { rest: Record<string, string | string[]> | undefined; never: boolean } {
  if (!match || !fixed) return { rest: match, never: false };
  const rest: Record<string, string | string[]> = {};
  for (const [axis, wanted] of Object.entries(match)) {
    if (!(axis in fixed.values)) {
      rest[axis] = wanted;
    } else if (!(Array.isArray(wanted) ? wanted : [wanted]).includes(fixed.values[axis])) {
      return { rest: undefined, never: true };
    }
  }
  return { rest: Object.keys(rest).length > 0 ? rest : undefined, never: false };
}

/**
 * The cells a part is rendered in, when its anatomy node limits them with `when` or `unless`.
 * Refuses an axis or value the contract does not declare. In a split set the split axis is
 * known: a part another value of it limits to is `never` rendered here.
 */
function shownIn(
  contract: ComponentContract,
  part: string,
  where: string,
  fixed?: FixedAxis,
): ShownIn | undefined | "never" {
  const node = anatomyNodeOf(contract.anatomy, part);
  if (!node?.when && !node?.unless) return undefined;
  const whenCells = againstFixed(node.when, fixed);
  if (whenCells.never) return "never";
  // `unless` hides the node only where every entry matches: a split value that does not match
  // makes it never hold in this set.
  const unlessCells = againstFixed(node.unless, fixed);
  const unlessRest = unlessCells.never ? undefined : unlessCells.rest;
  if (node.unless && !unlessCells.never && !unlessCells.rest) return "never";
  const reads: Record<string, string[]> = {};
  const normalize = (match: Record<string, string | string[]> | undefined) =>
    match
      ? Object.fromEntries(
          Object.entries(match).map(([axis, wanted]) => {
            const known = contract.axes.find((a) => a.prop === axis);
            const values = Array.isArray(wanted) ? wanted : [wanted];
            if (!known || values.some((v) => !known.values.includes(v))) {
              throw new Error(
                `${where} is rendered only in cells naming "${axis}" values the contract does not declare.`,
              );
            }
            reads[axis] = known.values;
            return [axis, values];
          }),
        )
      : undefined;
  const when = normalize(whenCells.rest);
  const unless = normalize(unlessRest);
  if (!when && !unless) return undefined;
  return { ...(when ? { when } : {}), ...(unless ? { unless } : {}), reads };
}

/** The parts the contract's Building Blocks own: each block's part and every part beneath it. */
function blockOwnedParts(contract: ComponentContract): Map<string, string> {
  const owner = new Map<string, string>();
  const collect = (node: AnatomyOrder, block: string) => {
    if (node.part !== undefined) owner.set(node.part, block);
    for (const child of node.children ?? []) collect(child, block);
  };
  for (const block of contract.buildingBlocks ?? []) {
    const node = anatomyNodeOf(contract.anatomy, block.part);
    if (node) collect(node, block.part);
  }
  return owner;
}

/** camelCase a property name (`Show Icon`) into a template local (`showIcon`). */
function propertyLocal(name: string): string {
  const words = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
  return words
    .map((word, i) => (i === 0 ? word[0].toLowerCase() : word[0].toUpperCase()) + word.slice(1))
    .join("");
}

/**
 * Where the anatomy renders each slot and each part, as a sortable position: nodes count in
 * document order, and several slots on one node keep their declared order. Content that the
 * template composes into one code prop (slots, text, icons) follows this order. Slots and parts
 * the anatomy never names sort after the rest, in declared order.
 */
function contentOrder(contract: ComponentContract): {
  slot: (name: string) => number;
  part: (name: string) => number;
} {
  const slots = new Map<string, number>();
  const parts = new Map<string, number>();
  let nodeIndex = 0;
  const walk = (node: AnatomyOrder | undefined) => {
    if (!node) return;
    nodeIndex += 1;
    if (node.part !== undefined && !parts.has(node.part)) parts.set(node.part, nodeIndex * 1000);
    (node.slots ?? []).forEach((slot, k) => {
      if (!slots.has(slot)) slots.set(slot, nodeIndex * 1000 + k);
    });
    for (const child of node.children ?? []) walk(child);
  };
  walk(contract.anatomy);
  const rest = (nodeIndex + 1) * 1000;
  const declared = new Map<string, number>();
  (contract.slots ?? []).forEach((slot, i) => {
    declared.set(slot.name, rest + i);
  });
  return {
    slot: (name) => slots.get(name) ?? declared.get(name) ?? rest,
    part: (name) => parts.get(name) ?? rest,
  };
}

/**
 * The folds of an axis: each group of code values that other axes select, mapped from the axis's
 * own Figma values. Refuses a fold that names an axis or value the contract lacks, a base value
 * the axis does not offer, or a code value the component's union does not accept. A fold that
 * names no other axis changes nothing in Figma, so it adds no branch.
 */
function axisFolds(
  component: string,
  axis: ContractAxis,
  axes: readonly ContractAxis[],
  literals: readonly string[],
): NonNullable<Extract<PropMapping, { kind: "enum" }>["folds"]> {
  const groups = new Map<
    string,
    { when: Record<string, string>; values: Record<string, string> }
  >();
  for (const [codeValue, target] of Object.entries(axis.foldedValues ?? {})) {
    const where = `"${component}" axis "${axis.prop}" folded value "${codeValue}"`;
    const base = target[axis.prop];
    if (base === undefined || !axis.values.includes(base)) {
      throw new Error(`${where} must name one of the axis values for "${axis.prop}".`);
    }
    if (!literals.includes(codeValue)) {
      throw new Error(
        `${where} is not accepted by the component's "${axis.prop}" prop (${literals.join(", ")}); the contract and the component disagree.`,
      );
    }
    const when: Record<string, string> = {};
    for (const [other, value] of Object.entries(target)) {
      if (other === axis.prop) continue;
      const otherAxis = axes.find((a) => a.prop === other);
      if (!otherAxis || !otherAxis.values.includes(value)) {
        throw new Error(`${where} names "${other}=${value}", which the contract does not declare.`);
      }
      when[other] = value;
    }
    if (Object.keys(when).length === 0) continue;
    const key = JSON.stringify(Object.entries(when).sort());
    const group = groups.get(key) ?? { when, values: {} };
    group.values[base] = codeValue;
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** Build the Figma node URL for a node from its file key + colon-form node id. */
export function figmaNodeUrl(fileKey: string, nodeId: string): string {
  return `https://www.figma.com/design/${fileKey}?node-id=${nodeId.replace(/:/g, "-")}`;
}

/**
 * The mappings for a design-only axis that declares `codeProps`: one per distinct code prop, over
 * the axis values that name it. Refuses a prop the component lacks or whose type cannot take the
 * declared value.
 */
function axisPropMappings(
  component: string,
  axis: ContractAxis,
  codeProps: CodeProps,
): PropMapping[] {
  const byProp = new Map<string, Record<string, string | boolean>>();
  for (const [axisValue, entry] of Object.entries(axis.codeProps ?? {})) {
    const code = codeProps[entry.prop];
    const where = `"${component}" axis "${axis.prop}" value "${axisValue}" sets code prop "${entry.prop}"`;
    if (!code) {
      throw new Error(
        `${where}, which the component does not have; the contract and the component disagree.`,
      );
    }
    const accepts =
      typeof entry.value === "boolean"
        ? code.type === "boolean"
        : code.type === "string" ||
          (code.type === "union" && (code.literals ?? []).includes(entry.value));
    if (!accepts) {
      throw new Error(
        `${where}, which does not accept ${JSON.stringify(entry.value)} (${code.type === "union" ? (code.literals ?? []).join(", ") : code.type}); the contract and the component disagree.`,
      );
    }
    byProp.set(entry.prop, { ...byProp.get(entry.prop), [axisValue]: entry.value });
  }
  return [...byProp].map(([prop, values]) => ({
    kind: "axisProp" as const,
    prop,
    figmaProp: axis.prop,
    values,
  }));
}

/**
 * The props a split set fixes: the code prop the split axis stands for, set to the set's value. An
 * axis that declares `codeProps` fixes those props; an axis that is a string-union code prop fixes
 * that prop. An axis with no code counterpart is design-only: the set's name carries it, and no
 * prop is fixed. Refuses a value the component does not accept, as an enum would.
 */
function fixedProps(
  component: string,
  axis: ContractAxis,
  value: string,
  codeProps: CodeProps,
  unmapped: UnmappedProperty[],
): Array<{ prop: string; value: string | boolean }> {
  const where = `"${component}" split axis "${axis.prop}" value "${value}"`;
  if (axis.codeProps) {
    const entry = axis.codeProps[value];
    if (!entry) return [];
    const mapped = axisPropMappings(
      component,
      { ...axis, codeProps: { [value]: entry } },
      codeProps,
    );
    return mapped.map(() => ({ prop: entry.prop, value: entry.value }));
  }
  const code = codeProps[axis.prop];
  if (!code || code.type !== "union" || !code.literals) {
    unmapped.push({ kind: "axis", name: axis.prop, reason: "design-only axis, no code prop" });
    return [];
  }
  if (!code.literals.includes(value)) {
    throw new Error(
      `${where} is not accepted by the component's "${axis.prop}" prop (${code.literals.join(", ")}); the contract and the component disagree.`,
    );
  }
  return [{ prop: axis.prop, value }];
}

/**
 * Derive a structured Code Connect mapping from a component's compiled contract, the component's
 * own props, and its manifest node id. The contract is the source of truth for the Figma
 * properties: the plugin creates one VARIANT property per axis (named by the axis `prop`, values
 * verbatim) and one native SLOT property per declared slot (named by the slot `name`), so those
 * are the only names a template may read.
 *
 * - An axis that is also a string-union code prop becomes an enum. Its values must all be members
 *   of the code union; otherwise this refuses.
 * - An axis with no code prop of that name is design-only (a display state) and is left out.
 * - An axis that shares a name with a code prop that is not a string union is left out as a
 *   design display state.
 * - An axis that declares `codeProps` stands for those code props: each distinct prop is read with
 *   one `getEnum` over the axis values that name it (`content=icon-only` is `iconOnly`). The prop
 *   must exist and its type must accept the value, or this refuses.
 * - An axis with `foldedValues` also folds other axes into its code value (`size` `icon-sm` is
 *   `content=icon-only` at `size=sm`): the template derives the code value from those Figma
 *   properties. Every folded value must be one the component's union accepts, or this refuses.
 * - A text property renders in its `codeProp` (a ReactNode prop, or a string prop as an attribute),
 *   an instance-swap property renders the swapped icon's own template into its `codeProp`, and a
 *   boolean property sets a boolean `codeProp`, or with `contentPresence` shows or hides the text
 *   or icon of its part. Content from slots, text and icons that share a prop (`children`)
 *   composes in anatomy order. A property with no `codeProp` is listed as not mapped.
 * - A slot renders in `slot.codeProp` when the contract declares it (`label` is `children`),
 *   which must be a ReactNode prop or this refuses. Several slots may name the same prop; they
 *   compose it in the order the anatomy renders them. Otherwise a slot named like a ReactNode
 *   code prop becomes that prop, and any other slot is left out.
 *
 * Nothing is inferred beyond these rules. The one disagreement it can detect, an axis value the
 * component's union does not accept, throws with the component, property and both sides, because a
 * guessed mapping would publish a wrong snippet.
 */
export function deriveMapping(input: {
  contract: ComponentContract;
  codeProps: CodeProps;
  manifest: FigmaManifestComponent;
  fileKey: string;
  importPath: string;
  /** The renderable tag, when it is not the export itself (a compound component's `X.Root`). */
  renderTag?: string;
  /** The exported name to import, when it is not `componentName` (a part's namespace, `Field`). */
  importName?: string;
  /**
   * The set of a split component this mapping is for: the split axis is no property of the set, so
   * its value becomes a fixed prop of the example, and anything that read it is decided here.
   */
  split?: FixedAxis;
}): CodeConnectMapping {
  const { contract, codeProps, manifest, fileKey, importPath, split } = input;
  const name = contract.componentName;
  // An empty string is as good as missing, so it falls back to the component set.
  const nodeId = manifest.nodeId || manifest.setId;
  if (!nodeId) {
    throw new Error(
      `Manifest entry for "${name}" has no nodeId or setId; Code Connect needs a Figma node id.`,
    );
  }

  const props: PropMapping[] = [];
  const unmapped: UnmappedProperty[] = [];
  const fixed: NonNullable<CodeConnectMapping["fixed"]> = [];
  // Axes another axis's fold reads: they are used, so they are not reported as unmapped.
  const consumed = new Set<string>();
  // What a Building Block owns is left to the block's own template.
  const blockOwned = blockOwnedParts(contract);

  for (const axis of contract.axes) {
    if (split && axis.prop in split.values) {
      fixed.push(...fixedProps(name, axis, split.values[axis.prop], codeProps, unmapped));
      continue;
    }
    if (contract.viewport && axis.prop === VIEWPORT_CONTEXT_AXIS) {
      unmapped.push({
        kind: "axis",
        name: axis.prop,
        reason: "viewport stand-in axis; the mapped popup component has no such property",
      });
      continue;
    }
    if (axis.codeProps) {
      props.push(...axisPropMappings(name, axis, codeProps));
      continue;
    }
    const code = codeProps[axis.prop];
    if (!code) {
      unmapped.push({ kind: "axis", name: axis.prop, reason: "design-only axis, no code prop" });
      continue;
    }
    if (code.type !== "union" || !code.literals) {
      // The contract reviewed this axis as a design display state that merely shares a name with
      // a code prop of another kind (a boolean, a node). Nothing maps; nothing is guessed.
      unmapped.push({
        kind: "axis",
        name: axis.prop,
        reason: `design-only axis; the code prop "${axis.prop}" is not a string union`,
      });
      continue;
    }
    const missing = axis.values.filter((v) => !code.literals?.includes(v));
    if (missing.length > 0) {
      throw new Error(
        `"${name}" axis "${axis.prop}" has value(s) ${missing.map((v) => `"${v}"`).join(", ")} that the component's "${axis.prop}" prop does not accept (${code.literals.join(", ")}); the contract and the component disagree.`,
      );
    }
    const folds = axisFolds(name, axis, contract.axes, code.literals);
    props.push({
      kind: "enum",
      prop: axis.prop,
      figmaProp: axis.prop,
      values: Object.fromEntries(axis.values.map((v) => [v, v])),
      ...(folds.length > 0
        ? {
            folds,
            reads: Object.fromEntries(
              [...new Set(folds.flatMap((fold) => Object.keys(fold.when)))].map((other) => [
                other,
                contract.axes.find((a) => a.prop === other)?.values ?? [],
              ]),
            ),
          }
        : {}),
    });
    for (const fold of folds) for (const used of Object.keys(fold.when)) consumed.add(used);
  }

  const order = contentOrder(contract);
  // Booleans are read first: a content-presence boolean gates the text or icon it controls.
  const properties = contract.properties ?? [];
  const gateOf = new Map<string, string>();
  for (const property of properties) {
    if (property.type !== "boolean" || !property.contentPresence) continue;
    gateOf.set(property.part, propertyLocal(property.name));
  }
  /** A property bound to a part a Building Block owns is the block's, not this component's. */
  const ownedByBlock = (property: { name: string; part: string }): boolean => {
    const owner = blockOwned.get(property.part);
    if (!owner) return false;
    unmapped.push({
      kind: "property",
      name: property.name,
      reason: `belongs to the "${owner}" Building Block`,
    });
    return true;
  };
  const carrierMapped = (part: string) =>
    properties.some(
      (p) => p.part === part && (p.type === "text" || p.type === "instanceSwap") && p.codeProp,
    );
  for (const property of properties) {
    if (property.type !== "boolean") continue;
    if (ownedByBlock(property)) continue;
    const local = propertyLocal(property.name);
    const where = `"${name}" property "${property.name}"`;
    if (property.contentPresence) {
      if (carrierMapped(property.part)) {
        const unless = Object.fromEntries(
          Object.entries(property.unless ?? {}).map(([axis, wanted]) => [
            axis,
            Array.isArray(wanted) ? wanted : [wanted],
          ]),
        );
        const reads: Record<string, string[]> = {};
        for (const [axis, wanted] of Object.entries(unless)) {
          const known = contract.axes.find((a) => a.prop === axis);
          if (!known || wanted.some((v) => !known.values.includes(v))) {
            throw new Error(
              `${where} \`unless\` names "${axis}" values the contract does not declare.`,
            );
          }
          reads[axis] = known.values;
        }
        props.push({
          kind: "presence",
          local,
          figmaProp: property.name,
          ...(Object.keys(unless).length > 0 ? { unless, reads } : {}),
        });
      } else {
        unmapped.push({
          kind: "property",
          name: property.name,
          reason: "gates content that has no code prop",
        });
      }
      continue;
    }
    if (property.codeProp === undefined) {
      unmapped.push({ kind: "property", name: property.name, reason: "design-only, no code prop" });
      continue;
    }
    const code = codeProps[property.codeProp];
    if (!code) {
      throw new Error(
        `${where} declares codeProp "${property.codeProp}", which the component does not have; the contract and the component disagree.`,
      );
    }
    if (code.type !== "boolean") {
      throw new Error(
        `${where} declares codeProp "${property.codeProp}", which is not a boolean; the contract and the component disagree.`,
      );
    }
    props.push({ kind: "boolean", local, prop: property.codeProp, figmaProp: property.name });
  }

  const content: Array<{ order: number; mapping: PropMapping }> = [];
  for (const slot of contract.slots ?? []) {
    const owner = slot.part === undefined ? undefined : blockOwned.get(slot.part);
    if (owner) {
      unmapped.push({
        kind: "slot",
        name: slot.name,
        reason: `belongs to the "${owner}" Building Block`,
      });
      continue;
    }
    const target = slot.codeProp ?? slot.name;
    const code = codeProps[target];
    if (slot.codeProp !== undefined) {
      // A declared mapping must hold; a mismatch is a disagreement, not a design-only slot.
      if (!code) {
        throw new Error(
          `"${name}" slot "${slot.name}" declares codeProp "${target}", which the component does not have; the contract and the component disagree.`,
        );
      }
      if (code.type !== "node") {
        throw new Error(
          `"${name}" slot "${slot.name}" declares codeProp "${target}", which is not renderable content; the contract and the component disagree.`,
        );
      }
    } else if (!code) {
      unmapped.push({ kind: "slot", name: slot.name, reason: "no code prop of that name" });
      continue;
    } else if (code.type !== "node") {
      unmapped.push({
        kind: "slot",
        name: slot.name,
        reason: `the code prop "${slot.name}" is not renderable content`,
      });
      continue;
    }
    content.push({
      order: order.slot(slot.name),
      mapping: {
        kind: "slot",
        local: localName(slot.name),
        prop: target,
        figmaProp: slot.name,
      },
    });
  }
  for (const property of properties) {
    if (property.type === "boolean") continue;
    if (ownedByBlock(property)) continue;
    const where = `"${name}" ${property.type === "text" ? "text" : "instance-swap"} property "${property.name}"`;
    if (property.codeProp === undefined) {
      unmapped.push({ kind: "property", name: property.name, reason: "no code prop declared" });
      continue;
    }
    const code = codeProps[property.codeProp];
    if (!code) {
      throw new Error(
        `${where} declares codeProp "${property.codeProp}", which the component does not have; the contract and the component disagree.`,
      );
    }
    const asString =
      property.type === "text" && code.type === "string" && property.codeProp !== "children";
    if (code.type !== "node" && !asString) {
      throw new Error(
        `${where} declares codeProp "${property.codeProp}", which is not ${property.type === "text" ? "renderable content or a string" : "renderable content"}; the contract and the component disagree.`,
      );
    }
    const gate = gateOf.get(property.part);
    const shown = shownIn(contract, property.part, where, split);
    if (shown === "never") {
      unmapped.push({
        kind: "property",
        name: property.name,
        reason: `its part is not rendered in the ${split?.id} set`,
      });
      continue;
    }
    const common = {
      local: propertyLocal(property.name),
      prop: property.codeProp,
      figmaProp: property.name,
      ...(gate ? { gate } : {}),
      ...(shown ? { shown } : {}),
    };
    content.push({
      order: order.part(property.part),
      mapping:
        property.type === "text"
          ? { kind: "text", ...common, ...(asString ? { asString: true } : {}) }
          : { kind: "swap", ...common },
    });
  }
  content.sort((x, y) => x.order - y.order);
  props.push(...content.map((entry) => entry.mapping));

  // An axis another axis's fold reads is used, so it is not reported as design-only.
  const notes = unmapped.filter((u) => !(u.kind === "axis" && consumed.has(u.name)));

  return {
    componentName: name,
    renderTag: input.renderTag ?? name,
    ...(input.importName ? { importName: input.importName } : {}),
    importPath,
    figmaUrl: figmaNodeUrl(fileKey, nodeId),
    source: typeof manifest.source === "string" ? manifest.source : undefined,
    ...(fixed.length > 0 ? { fixed } : {}),
    ...(split ? { idSuffix: split.id } : {}),
    props,
    unmapped: notes,
  };
}
