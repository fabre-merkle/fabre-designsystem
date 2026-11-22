import type {
  FigmaGenerationContract,
  GenerationContractAnatomyNode,
  GenerationContractRuntimeValue,
  ValueOf,
} from "./types";

export const RUNTIME_VALUE_MIN = 0;
export const RUNTIME_VALUE_MAX = 100;

/**
 * Parse one authored runtime value. Returns `undefined` for anything that is not
 * a plain finite number inside `[RUNTIME_VALUE_MIN, RUNTIME_VALUE_MAX]` — the
 * whole string must be the number (`"40"`, `"12.5"`), so `"40px"` or `"40%"` is
 * rejected rather than half-read the way `parseFloat` would.
 */
export function parseRuntimeValuePercent(raw: string | undefined): number | undefined {
  if (raw === undefined || !/^\s*-?\d+(\.\d+)?\s*$/.test(raw)) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < RUNTIME_VALUE_MIN || value > RUNTIME_VALUE_MAX) {
    return undefined;
  }
  return value;
}

/** The `runtimeValue` name a `valueOf` reads, or `undefined` for a slot-sourced one. */
export function runtimeValueNameOf(declared: { kind: string } | undefined): string | undefined {
  if (declared?.kind !== "valueOf") return undefined;
  const name = (declared as ValueOf & { runtimeValue?: unknown }).runtimeValue;
  return typeof name === "string" ? name : undefined;
}

/** The slot name a `valueOf` reads, or `undefined` for a runtime-value-sourced one. */
export function slotNameOf(declared: { kind: string } | undefined): string | undefined {
  if (declared?.kind !== "valueOf") return undefined;
  const name = (declared as ValueOf & { slot?: unknown }).slot;
  return typeof name === "string" ? name : undefined;
}

function matchesCondition(
  key: Record<string, string>,
  condition: Record<string, string | string[]> | undefined,
): boolean {
  return Object.entries(condition ?? {}).every(([axis, value]) =>
    Array.isArray(value) ? value.includes(key[axis]) : key[axis] === value,
  );
}

interface LocatedNode {
  node: GenerationContractAnatomyNode;
  /** Every `when`/`unless` from the root down to (and including) this node. */
  conditions: Array<Pick<GenerationContractAnatomyNode, "when" | "unless">>;
}

function locateNodes(anatomy: GenerationContractAnatomyNode | undefined): Map<string, LocatedNode> {
  const located = new Map<string, LocatedNode>();
  const walk = (
    node: GenerationContractAnatomyNode,
    conditions: LocatedNode["conditions"],
  ): void => {
    const own = [...conditions, { when: node.when, unless: node.unless }];
    if (!located.has(node.part)) located.set(node.part, { node, conditions: own });
    for (const child of node.children ?? []) walk(child, own);
  };
  if (anatomy) walk(anatomy, []);
  return located;
}

/** Is a part with these conditions rendered for this documentation example? */
function renderedFor(conditions: LocatedNode["conditions"], key: Record<string, string>): boolean {
  return conditions.every(
    ({ when, unless }) => matchesCondition(key, when) && !(unless && matchesCondition(key, unless)),
  );
}

export function runtimeValueErrors(contract: FigmaGenerationContract): string[] {
  const errors: string[] = [];
  const slug = contract.slug;
  const declarations = new Map<string, GenerationContractRuntimeValue>();
  for (const declaration of contract.runtimeValues ?? []) {
    if (declarations.has(declaration.name)) {
      errors.push(`"${slug}" declares runtime value "${declaration.name}" more than once.`);
    }
    declarations.set(declaration.name, declaration);
  }
  const located = locateNodes(contract.anatomy);

  // Consumers: every `valueOf: { runtimeValue }` on an anatomy node.
  const consumed = new Set<string>();
  const checkConsumer = (
    node: GenerationContractAnatomyNode,
    field: string,
    declared: { kind: string } | undefined,
    measures: GenerationContractRuntimeValue["measures"],
  ): void => {
    const name = runtimeValueNameOf(declared);
    if (name === undefined) return;
    const declaration = declarations.get(name);
    if (!declaration) {
      errors.push(
        `"${slug}" anatomy part "${node.part}" ${field} references undeclared runtime value "${name}".`,
      );
      return;
    }
    consumed.add(name);
    if (declaration.part !== node.part) {
      errors.push(
        `"${slug}" anatomy part "${node.part}" ${field} reads runtime value "${name}", which is declared for part "${declaration.part}".`,
      );
    }
    if (declaration.measures !== measures) {
      errors.push(
        `"${slug}" anatomy part "${node.part}" ${field} needs a runtime value that measures "${measures}", but "${name}" measures "${declaration.measures}".`,
      );
    }
  };
  for (const { node } of located.values()) {
    checkConsumer(node, "positionAlongMain", node.positionAlongMain, "travel");
    for (const [value, declared] of Object.entries(node.positionAlongMainByAxis?.values ?? {})) {
      checkConsumer(node, `positionAlongMainByAxis["${value}"]`, declared, "travel");
    }
    checkConsumer(node, "sizeAlongMain", node.sizeAlongMain, "length");
  }

  for (const declaration of declarations.values()) {
    const label = `"${slug}" runtime value "${declaration.name}"`;
    if (!declaration.reason?.trim()) errors.push(`${label} must have a non-empty reason.`);
    if (declaration.measures !== "length" && declaration.measures !== "travel") {
      errors.push(`${label} must measure "length" or "travel".`);
    }
    for (const property of declaration.replaces ?? []) {
      if (!/^--[\w-]+$/.test(property)) {
        errors.push(`${label} replaces "${property}", which is not a CSS custom property.`);
      }
    }
    const target = located.get(declaration.part);
    if (!contract.parts.includes(declaration.part) || !target) {
      errors.push(`${label} names part "${declaration.part}", which is not in the anatomy.`);
      continue;
    }
    if (declaration.replaces.length > 0) {
      if (declaration.measures !== "length") {
        errors.push(`${label} replaces CSS sizes, so it must measure "length".`);
      }
      if (!target.node.removeFromFlow && !target.node.removeFromFlowByAxis) {
        errors.push(
          `${label} replaces CSS sizes on "${declaration.part}", which is not removeFromFlow — its parent's box is not final when the size would be applied.`,
        );
      }
    }
    if (declaration.replaces.length === 0 && !consumed.has(declaration.name)) {
      errors.push(
        `${label} is never used — list the CSS properties it replaces, or read it with a valueOf on "${declaration.part}".`,
      );
    }
    contract.documentation.examples.forEach((example) => {
      const raw = example.runtimeValues?.[declaration.name];
      // A value is only required where the part renders, but any value given must be valid: a
      // Building Block's example takes it from a parent example that need not render the part.
      if (raw === undefined && !renderedFor(target.conditions, example.key)) return;
      if (raw === undefined) {
        errors.push(
          `"${slug}" documentation example "${example.label}" is missing runtime value "${declaration.name}" (it renders "${declaration.part}").`,
        );
      } else if (parseRuntimeValuePercent(raw) === undefined) {
        errors.push(
          `"${slug}" documentation example "${example.label}" runtime value "${declaration.name}" is "${raw}" — it must be a number from ${RUNTIME_VALUE_MIN} to ${RUNTIME_VALUE_MAX}.`,
        );
      }
    });
  }

  for (const example of contract.documentation.examples) {
    for (const name of Object.keys(example.runtimeValues ?? {})) {
      if (!declarations.has(name)) {
        errors.push(
          `"${slug}" documentation example "${example.label}" sets undeclared runtime value "${name}".`,
        );
      }
    }
  }
  return errors;
}
