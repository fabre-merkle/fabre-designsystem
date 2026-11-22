import type {
  FigmaGenerationContract,
  GenerationContractAnatomyNode,
  GenerationContractProperty,
} from "./types";

/** The Figma property type each contract property type creates. */
export const FIGMA_PROPERTY_TYPE = {
  text: "TEXT",
  boolean: "BOOLEAN",
  instanceSwap: "INSTANCE_SWAP",
} as const satisfies Record<GenerationContractProperty["type"], string>;

function anatomyNodeFor(
  node: GenerationContractAnatomyNode | undefined,
  part: string,
): GenerationContractAnatomyNode | undefined {
  if (!node) return undefined;
  if (node.part === part) return node;
  for (const child of node.children ?? []) {
    const found = anatomyNodeFor(child, part);
    if (found) return found;
  }
  return undefined;
}

/**
 * Every refusal for a contract's component properties, as readable lines (empty when valid). Run
 * at build time and again when a compiled artifact is loaded, so the two cannot disagree.
 *
 * - A property's part is declared and materialized by the anatomy.
 * - Names are unique and share one namespace with axis props and slot names.
 * - A text property sits on a text part, an instance swap on an icon part with an `iconName`.
 * - A text or instance-swap part is not also a slot's part: a slot holds arbitrary children, a
 *   property holds one typed value, and a part is exactly one of the two.
 * - A boolean's `unless` names declared axes and values; `codeProp` and `contentPresence` are
 *   exclusive, and `contentPresence` needs a text or instance-swap property on the same part.
 * - A part carries at most one property of each type.
 * - A viewport-placed component declares none: its popup is generated as a separate component.
 */
export function propertyErrors(contract: FigmaGenerationContract): string[] {
  const properties = contract.properties;
  if (!properties?.length) return [];
  const errors: string[] = [];
  const at = (property: GenerationContractProperty) =>
    `"${contract.slug}" property "${property.name}"`;
  if (contract.viewport) {
    errors.push(
      `"${contract.slug}" declares properties and a viewport; a window-placed component's popup is a separate component, so properties are not supported there.`,
    );
  }
  const taken = new Map<string, string>();
  for (const axis of contract.axes) taken.set(axis.prop, `axis "${axis.prop}"`);
  for (const slot of contract.slots ?? []) taken.set(slot.name, `slot "${slot.name}"`);
  const slotParts = new Set((contract.slots ?? []).map((slot) => slot.part));
  const seenOnPart = new Set<string>();
  for (const property of properties) {
    const where = at(property);
    if (!property.name.trim()) {
      errors.push(`"${contract.slug}" has a property without a name.`);
      continue;
    }
    const clash = taken.get(property.name);
    if (clash) {
      errors.push(`${where} has the same name as ${clash}; names share one namespace in Figma.`);
    } else {
      taken.set(property.name, `property "${property.name}"`);
    }
    if (!contract.parts.includes(property.part)) {
      errors.push(`${where} references undeclared part "${property.part}".`);
      continue;
    }
    const node = anatomyNodeFor(contract.anatomy, property.part);
    if (!node) {
      errors.push(
        `${where} references part "${property.part}", which the anatomy does not render.`,
      );
      continue;
    }
    const typedKey = `${property.part}\u0000${property.type}`;
    if (seenOnPart.has(typedKey)) {
      errors.push(`${where} is a second ${property.type} property on part "${property.part}".`);
    }
    seenOnPart.add(typedKey);
    if (property.type === "text" && node.kind !== "text") {
      errors.push(`${where} is a text property, so part "${property.part}" must be a text node.`);
    }
    if (property.type === "instanceSwap" && (node.kind !== "icon" || !node.iconName)) {
      errors.push(
        `${where} is an instance swap, so part "${property.part}" must be an icon node with an iconName (its default icon).`,
      );
    }
    if (property.type !== "boolean" && slotParts.has(property.part)) {
      errors.push(
        `${where} is bound to part "${property.part}", which a slot also fills; a part is a slot or a property, not both.`,
      );
    }
    if (property.type === "boolean") {
      if (property.codeProp !== undefined && property.contentPresence) {
        errors.push(`${where} declares both codeProp and contentPresence; choose one.`);
      }
      if (property.contentPresence) {
        const carriers = properties.filter(
          (other) =>
            other.part === property.part &&
            (other.type === "text" || other.type === "instanceSwap"),
        );
        if (carriers.length !== 1) {
          errors.push(
            `${where} declares contentPresence, so part "${property.part}" needs exactly one text or instance-swap property, found ${carriers.length}.`,
          );
        }
      }
      for (const [axisProp, wanted] of Object.entries(property.unless ?? {})) {
        const axis = contract.axes.find((candidate) => candidate.prop === axisProp);
        if (!axis) {
          errors.push(`${where} \`unless\` names undeclared axis "${axisProp}".`);
          continue;
        }
        for (const value of Array.isArray(wanted) ? wanted : [wanted]) {
          if (!axis.values.includes(value)) {
            errors.push(`${where} \`unless\` names "${axisProp}=${value}", not a declared value.`);
          }
        }
      }
    }
  }
  return errors;
}
