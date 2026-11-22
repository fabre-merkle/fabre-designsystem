import { buildingBlockParts } from "./component-sets";
import { diagnosticPath, refusal } from "./diagnostics";
import type { FigmaGenerationContract, GenerationContractAnatomyNode } from "./types";

/**
 * Every contract, keyed by slug, for graph lookups. Callers already have this
 * shape (or can build it in one line) — kept as a plain `Map` rather than a
 * bespoke "graph" type so it composes with `buildGenerationContractArtifact`'s
 * own `inputs` array and with a loaded `GenerationContractArtifact.components`.
 */
export function contractsBySlug(
  contracts: readonly FigmaGenerationContract[],
): Map<string, FigmaGenerationContract> {
  return new Map(contracts.map((contract) => [contract.slug, contract]));
}

interface ComposedChildEdge {
  slotName: string;
  slotPart: string;
  childSlug: string;
  variantKey?: Record<string, string>;
  variantKeyFromAxes?: Record<string, string>;
}

/** The Building Block whose set builds `part`, when the part is inside one. */
function owningBlock(contract: FigmaGenerationContract, part: string) {
  for (const [blockPart, parts] of buildingBlockParts(contract)) {
    if (parts.has(part)) return contract.buildingBlocks?.find((block) => block.part === blockPart);
  }
  return undefined;
}

/** One contract's composed-child edges, in declaration order (slot order, then). */
function composedChildEdges(contract: FigmaGenerationContract): ComposedChildEdge[] {
  const edges: ComposedChildEdge[] = [];
  for (const slot of contract.slots ?? []) {
    if (!slot.composedChild) continue;
    edges.push({
      slotName: slot.name,
      slotPart: slot.part,
      childSlug: slot.composedChild.component,
      variantKey: slot.composedChild.variantKey,
      variantKeyFromAxes: slot.composedChild.variantKeyFromAxes,
    });
  }
  return edges;
}

/** Flattens an anatomy tree into a list, parent before children. */
export function anatomyNodes(
  node: GenerationContractAnatomyNode | undefined,
  into: GenerationContractAnatomyNode[] = [],
): GenerationContractAnatomyNode[] {
  if (!node) return into;
  into.push(node);
  for (const child of node.children ?? []) anatomyNodes(child, into);
  return into;
}

/**
 * Where a parent example's text for a composed instance lands: the one text slot of `contract` (a
 * slot whose part is a text node and that is not itself composed), or, when it has no such slot,
 * its one text property. `undefined` unless there is exactly one of those.
 */
export function composedChildTextSlot(contract: FigmaGenerationContract): string | undefined {
  const nodes = anatomyNodes(contract.anatomy);
  const textSlots = (contract.slots ?? []).filter(
    (slot) =>
      !slot.composedChild && nodes.some((node) => node.kind === "text" && node.part === slot.part),
  );
  if (textSlots.length > 0) return textSlots.length === 1 ? textSlots[0].name : undefined;
  const textProperties = (contract.properties ?? []).filter((property) => property.type === "text");
  return textProperties.length === 1 ? textProperties[0].name : undefined;
}

/** Whether any documentation example or anatomy item supplies text for the parent's `slotName`. */
function suppliesText(contract: FigmaGenerationContract, slotName: string): boolean {
  if (contract.documentation.examples.some((example) => example.slots?.[slotName] !== undefined)) {
    return true;
  }
  return anatomyNodes(contract.anatomy).some((node) =>
    node.items?.some((item) => item.slots?.[slotName] !== undefined),
  );
}

export function validateComposedChildReferences(
  contracts: readonly FigmaGenerationContract[],
): void {
  const bySlug = contractsBySlug(contracts);
  for (const contract of contracts) {
    for (const edge of composedChildEdges(contract)) {
      const child = bySlug.get(edge.childSlug);
      if (!child) {
        throw refusal(
          "composition-invalid",
          `"${contract.slug}" slot "${edge.slotName}" composed child references unknown component "${edge.childSlug}".`,
          diagnosticPath(contract.slug, ["slots", edge.slotName]),
        );
      }
      // Text an example or item supplies for a composed slot overrides the child's own text, so the
      // child must have exactly one text slot for it to land in.
      if (suppliesText(contract, edge.slotName) && !composedChildTextSlot(child)) {
        throw refusal(
          "composition-invalid",
          `"${contract.slug}" supplies text for slot "${edge.slotName}", but its composed child "${edge.childSlug}" does not have exactly one text slot or text property to receive it.`,
          diagnosticPath(contract.slug, ["slots", edge.slotName]),
        );
      }
      for (const [axis, value] of Object.entries(edge.variantKey ?? {})) {
        const knownAxis = child.axes.find((candidate) => candidate.prop === axis);
        if (!knownAxis?.values.includes(value)) {
          throw refusal(
            "composition-invalid",
            `"${contract.slug}" slot "${edge.slotName}" composed child "${edge.childSlug}" variantKey has unknown ${axis} value "${value}".`,
            diagnosticPath(contract.slug, [
              "slots",
              edge.slotName,
              "composedChild",
              "variantKey",
              axis,
            ]),
          );
        }
      }
      for (const [childAxis, parentAxis] of Object.entries(edge.variantKeyFromAxes ?? {})) {
        const at = diagnosticPath(contract.slug, [
          "slots",
          edge.slotName,
          "composedChild",
          "variantKeyFromAxes",
          childAxis,
        ]);
        const knownChildAxis = child.axes.find((candidate) => candidate.prop === childAxis);
        if (!knownChildAxis) {
          throw refusal(
            "composition-invalid",
            `"${contract.slug}" slot "${edge.slotName}" composed child "${edge.childSlug}" variantKeyFromAxes names unknown axis "${childAxis}" of the child.`,
            at,
          );
        }
        // A slot inside a Building Block is built in the block's own set, which has only the
        // block's axes: the child can follow only those.
        const block = owningBlock(contract, edge.slotPart);
        const parentAxes = block ? block.axes : contract.axes;
        const knownParentAxis = parentAxes.find((candidate) => candidate.prop === parentAxis);
        if (!knownParentAxis) {
          throw refusal(
            "composition-invalid",
            block
              ? `"${contract.slug}" slot "${edge.slotName}" composed child "${edge.childSlug}" variantKeyFromAxes maps "${childAxis}" to "${parentAxis}", which is not an axis of its Building Block "${block.part}".`
              : `"${contract.slug}" slot "${edge.slotName}" composed child "${edge.childSlug}" variantKeyFromAxes maps "${childAxis}" to unknown axis "${parentAxis}" of the parent.`,
            at,
          );
        }
        for (const value of knownParentAxis.values ?? []) {
          if (!knownChildAxis.values.includes(value)) {
            throw refusal(
              "composition-invalid",
              `"${contract.slug}" slot "${edge.slotName}" composed child "${edge.childSlug}" variantKeyFromAxes maps "${childAxis}" to "${parentAxis}", but its value "${value}" is not a ${childAxis} value of the child.`,
              at,
            );
          }
        }
      }
    }
  }
}

/**
 * Depth-first cycle detection over the composed-child graph (an edge from A to B
 * when A declares a slot whose composed child is B). Contracts and their edges
 * are visited in a stable, caller-independent order (sorted slug, then
 * declaration order) so the SAME cyclic graph always produces the SAME
 * diagnostic, regardless of input array order.
 *
 * Reports the first cycle found as a deterministic chain naming every component
 * in it, e.g. `toggle-group → field → toggle-group` — not just "a cycle exists".
 * A direct A↔B cycle and a longer transitive one both take this same path.
 */
export function validateNoCompositionCycles(contracts: readonly FigmaGenerationContract[]): void {
  const bySlug = contractsBySlug(contracts);
  const sortedSlugs = [...bySlug.keys()].sort((a, b) => a.localeCompare(b));

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>(sortedSlugs.map((slug) => [slug, WHITE]));
  const stack: string[] = [];

  function childrenOf(slug: string): string[] {
    const contract = bySlug.get(slug);
    if (!contract) return [];
    return composedChildEdges(contract)
      .map((edge) => edge.childSlug)
      .filter((childSlug) => bySlug.has(childSlug));
  }

  function visit(slug: string): void {
    color.set(slug, GRAY);
    stack.push(slug);
    for (const child of childrenOf(slug)) {
      const childColor = color.get(child);
      if (childColor === GRAY) {
        const cycleStart = stack.indexOf(child);
        const cycle = [...stack.slice(cycleStart), child];
        throw refusal(
          "composition-invalid",
          `Composition cycle detected: ${cycle.join(" → ")}.`,
          cycle[0],
        );
      }
      if (childColor === WHITE) visit(child);
    }
    stack.pop();
    color.set(slug, BLACK);
  }

  for (const slug of sortedSlugs) {
    if (color.get(slug) === WHITE) visit(slug);
  }
}

/**
 * Full pre-flight composition validation: unknown-child references, then cycles.
 * Unknown-reference checking runs first because a cycle diagnostic naming a
 * component that doesn't even exist would be a confusing thing to see before the
 * more basic problem is reported.
 */
export function validateComposition(contracts: readonly FigmaGenerationContract[]): void {
  validateComposedChildReferences(contracts);
  validateNoCompositionCycles(contracts);
}

export interface DependencyOrderResult {
  /** Selected slugs plus every composed-child dependency, leaves-before-consumers. */
  order: string[];
  forced: string[];
}

export function resolveDependencyOrder(
  selectedSlugs: readonly string[],
  contracts: readonly FigmaGenerationContract[],
): DependencyOrderResult {
  const bySlug = contractsBySlug(contracts);
  const selected = new Set(selectedSlugs);
  const closure = new Set<string>();

  function include(slug: string): void {
    if (closure.has(slug) || !bySlug.has(slug)) return;
    closure.add(slug);
    const contract = bySlug.get(slug);
    if (!contract) return;
    for (const edge of composedChildEdges(contract)) include(edge.childSlug);
  }
  for (const slug of [...selectedSlugs].sort((a, b) => a.localeCompare(b))) include(slug);

  // Kahn's algorithm: an edge from consumer -> child means "child before
  // consumer", so `inDegree` counts how many not-yet-placed children a slug is
  // still waiting on.
  const dependents = new Map<string, string[]>(); // childSlug -> [consumers that need it]
  const remainingDeps = new Map<string, number>();
  for (const slug of closure) remainingDeps.set(slug, 0);
  for (const slug of closure) {
    const contract = bySlug.get(slug);
    if (!contract) continue;
    const children = new Set(composedChildEdges(contract).map((edge) => edge.childSlug));
    for (const child of children) {
      if (!closure.has(child)) continue;
      remainingDeps.set(slug, (remainingDeps.get(slug) ?? 0) + 1);
      dependents.set(child, [...(dependents.get(child) ?? []), slug]);
    }
  }

  const order: string[] = [];
  const ready = [...closure]
    .filter((slug) => (remainingDeps.get(slug) ?? 0) === 0)
    .sort((a, b) => a.localeCompare(b));
  const readyQueue = [...ready];
  while (readyQueue.length > 0) {
    const slug = readyQueue.shift();
    if (!slug) continue;
    order.push(slug);
    const nextReady: string[] = [];
    for (const consumer of dependents.get(slug) ?? []) {
      const remaining = (remainingDeps.get(consumer) ?? 0) - 1;
      remainingDeps.set(consumer, remaining);
      if (remaining === 0) nextReady.push(consumer);
    }
    readyQueue.push(...nextReady.sort((a, b) => a.localeCompare(b)));
  }

  if (order.length !== closure.size) {
    // Guarded by `validateComposition` in every real caller — this is a
    // programmer-error backstop, not a user-facing message.
    throw new Error("resolveDependencyOrder: composition graph has a cycle.");
  }

  const forced = order.filter((slug) => !selected.has(slug));
  return { order, forced };
}
