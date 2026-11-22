import type { ComponentRegistryAxis } from "../registry/types";
import { refusal } from "./diagnostics";
import type { FigmaGenerationContract, GenerationContractSlot } from "./types";

/**
 * Checks `key` against `axes` and returns it complete. `subject` prefixes each error, for
 * example `"dialog" slot "action" composed child "button" variantKey`.
 */
function normalizeKey(
  key: Record<string, string>,
  axes: readonly ComponentRegistryAxis[],
  subject: string,
): Record<string, string> {
  for (const [prop, value] of Object.entries(key)) {
    const axis = axes.find((candidate) => candidate.prop === prop);
    if (!axis) throw refusal("unknown-axis", `${subject} has unknown axis "${prop}".`);
    if (!axis.values.includes(value)) {
      throw refusal("unknown-axis-value", `${subject} has unknown ${prop} value "${value}".`);
    }
  }
  if (axes.every((axis) => Object.hasOwn(key, axis.prop))) return key;
  return Object.fromEntries(axes.map((axis) => [axis.prop, key[axis.prop] ?? axis.default]));
}

function normalizeSlot(
  contract: FigmaGenerationContract,
  slot: GenerationContractSlot,
  bySlug: ReadonlyMap<string, FigmaGenerationContract>,
): GenerationContractSlot {
  const composedChild = slot.composedChild;
  if (!composedChild?.variantKey) return slot;
  // An unknown component is reported by composition validation, with its own message.
  const child = bySlug.get(composedChild.component);
  if (!child) return slot;
  const variantKey = normalizeKey(
    composedChild.variantKey,
    child.axes,
    `"${contract.slug}" slot "${slot.name}" composed child "${child.slug}" variantKey`,
  );
  if (variantKey === composedChild.variantKey) return slot;
  return { ...slot, composedChild: { ...composedChild, variantKey } };
}

/** Expands each supplied composed-child `variantKey` against the child contract's axes. */
export function normalizeComposedChildKeys(
  contracts: readonly FigmaGenerationContract[],
): FigmaGenerationContract[] {
  const bySlug = new Map(contracts.map((contract) => [contract.slug, contract]));
  return contracts.map((contract) => {
    const slots = contract.slots?.map((slot) => normalizeSlot(contract, slot, bySlug));
    if (!slots?.some((slot, index) => slot !== contract.slots?.[index])) return contract;
    return { ...contract, slots };
  });
}

/** Expands each documentation example's `key` against the contract's own axes. */
export function normalizeExampleKeys(contract: FigmaGenerationContract): FigmaGenerationContract {
  const examples = contract.documentation.examples.map((example) => {
    const key = normalizeKey(
      example.key,
      contract.axes,
      `"${contract.slug}" example "${example.label}" key`,
    );
    return key === example.key ? example : { ...example, key };
  });
  if (!examples.some((example, index) => example !== contract.documentation.examples[index])) {
    return contract;
  }
  return { ...contract, documentation: { ...contract.documentation, examples } };
}

/**
 * The whole authored → normalized step for a contract set. Composed-child keys are expanded
 * against the CHILD contract's axes, so the set must hold every contract a composed child names.
 * The compiler applies the two halves at separate points (composed-child keys over the set,
 * example keys per contract after its viewport checks), with the same result.
 */
export function normalizeFigmaContracts(
  contracts: readonly FigmaGenerationContract[],
): FigmaGenerationContract[] {
  return normalizeComposedChildKeys(contracts).map(normalizeExampleKeys);
}
