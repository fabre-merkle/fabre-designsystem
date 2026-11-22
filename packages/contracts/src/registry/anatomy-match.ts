import {
  type ParsedAttributeSelector,
  type ParsedCompoundSelector,
  parseStructuralPseudo,
  type RelativeStep,
  type StructuralPseudo,
} from "./css-parser";
import type { AnatomyNodeLike, ResolveAnatomy } from "./types";

/** `true`, `false`, or `"unknown"` when the rendered anatomy cannot settle the question. */
export type Tri = boolean | "unknown";

/** One rendered part of a cell, with the parts rendered inside it in order. */
export interface RenderedNode {
  part: string;
  children: RenderedNode[];
  parent?: RenderedNode;
}

/** Whether a `when`/`unless` condition (a value, or any of several) holds for a cell. */
function conditionHolds(
  key: Record<string, string>,
  condition: Record<string, string | string[]> | undefined,
): boolean {
  return Object.entries(condition ?? {}).every(([axis, value]) =>
    Array.isArray(value) ? value.includes(key[axis]) : key[axis] === value,
  );
}

/**
 * The parts one cell renders, nested as the anatomy nests them. A node renders when its `when`
 * holds and its `unless` does not. A synthetic node has no element of its own in the component, so
 * its children belong to the part around it. Undefined when the root itself is not rendered.
 */
export function renderedTree(
  anatomy: ResolveAnatomy,
  key: Record<string, string>,
): RenderedNode | undefined {
  const build = (node: AnatomyNodeLike): RenderedNode[] => {
    if (node.when && !conditionHolds(key, node.when)) return [];
    if (node.unless && conditionHolds(key, node.unless)) return [];
    const children = (node.children ?? []).flatMap(build);
    if (node.synthetic) return children;
    const rendered: RenderedNode = { part: node.part, children };
    for (const child of children) child.parent = rendered;
    return [rendered];
  };
  return build(anatomy.root)[0];
}

/**
 * The selectors one axis's values hold under, each with the positions of every value whose
 * fragment contains it. A fragment of several attributes (`[data-has-icon][data-icon-side="end"]`)
 * is split into those attributes, because a browser applies a rule on `[data-has-icon]` to every
 * element that carries it: the value selecting `[data-has-icon]` alone and the value selecting
 * both attributes both hold it. Any other fragment (`:hover`, a single attribute) stands for
 * itself. A cell holds a rule's selector when its value is among the positions, and a rule naming
 * several attributes holds when each one does.
 */
export function fragmentValueSets(fragments: readonly (string | null)[]): Map<string, number[]> {
  const sets = new Map<string, number[]>();
  fragments.forEach((fragment, position) => {
    if (fragment === null) return;
    const pieces = fragment.match(/\[[^\]]+\]/g) ?? [];
    const keys = pieces.length > 1 && pieces.join("") === fragment ? pieces : [fragment];
    for (const key of keys) {
      const positions = sets.get(key) ?? [];
      if (!positions.includes(position)) positions.push(position);
      sets.set(key, positions);
    }
  });
  return sets;
}

/** What the evaluator needs to know besides the tree. */
export interface StructureContext {
  /** Every part the contract declares. A part outside it is not known to be absent. */
  modelled: ReadonlySet<string>;
  /** Parts the component renders that the contract leaves out; they may sit anywhere. */
  omitted: ReadonlySet<string>;
  /**
   * Whether a non-`data-ui` attribute selector holds for the cell: `true` or `false` when it names
   * an axis fragment, `"unknown"` otherwise. Negated attributes are already flipped.
   */
  attribute: (compound: ParsedCompoundSelector, attribute: ParsedAttributeSelector) => Tri;
}

/** The data-ui value a compound names, or undefined when it names none (or more than one). */
export function partOf(compound: ParsedCompoundSelector): string | undefined {
  const parts = compound.attributes.filter(
    (attribute) => attribute.name === "data-ui" && !attribute.negated && attribute.value !== null,
  );
  return parts.length === 1 ? (parts[0].value ?? undefined) : undefined;
}

/** Whether a compound is something the anatomy can answer for: a modelled part, axis attributes, nested structure. */
function compoundKnown(
  compound: ParsedCompoundSelector,
  scope: Pick<StaticScope, "modelled" | "omitted" | "axisFragments" | "positions">,
): boolean {
  if (compound.type !== undefined || (compound.lists?.length ?? 0) > 0) return false;
  const part = partOf(compound);
  if (part === undefined || !scope.modelled.has(part) || scope.omitted.has(part)) return false;
  for (const attribute of compound.attributes) {
    if (attribute.name === "data-ui") {
      if (attribute.negated) return false;
      continue;
    }
    const fragment =
      attribute.value === null ? `[${attribute.name}]` : `[${attribute.name}="${attribute.value}"]`;
    if (!scope.axisFragments.has(fragment)) return false;
  }
  return compound.pseudos.every((pseudo) => pseudoKnown(pseudo, scope));
}

function pseudoKnown(
  pseudo: string,
  scope: Pick<StaticScope, "modelled" | "omitted" | "axisFragments" | "positions">,
): boolean {
  const structural = parseStructuralPseudo(pseudo);
  if (!structural) return false;
  if (structural.kind === "position") return scope.positions;
  return (
    structural.alternatives.length > 0 &&
    structural.alternatives.every((steps) =>
      steps.every(
        (step) =>
          (step.combinator === ">" || step.combinator === " ") &&
          compoundKnown(step.compound, scope),
      ),
    )
  );
}

/** What a contract says about the parts, without a cell: enough to tell whether a selector can be evaluated at all. */
export interface StaticScope {
  modelled: ReadonlySet<string>;
  omitted: ReadonlySet<string>;
  /** The axis selector fragments, such as `[data-panel-open]` or `[data-size="md"]`. */
  axisFragments: ReadonlySet<string>;
  /** Whether sibling order can be trusted: the contract has an anatomy and leaves no part out. */
  positions: boolean;
}

/**
 * Whether every `:has()` and position pseudo-class in one expanded selector (a list of plain
 * compounds) can be settled from the anatomy of any cell. The compiler uses this to stop warning
 * about a selector the resolver does evaluate.
 */
export function selectorEvaluable(
  compounds: readonly ParsedCompoundSelector[],
  scope: StaticScope,
): boolean {
  return compounds.every((compound) => {
    const structural = compound.pseudos.filter((pseudo) => parseStructuralPseudo(pseudo));
    if (structural.length === 0) return true;
    const part = partOf(compound);
    if (part === undefined || !scope.modelled.has(part) || scope.omitted.has(part)) return false;
    return structural.every((pseudo) => pseudoKnown(pseudo, scope));
  });
}

function descendants(node: RenderedNode): RenderedNode[] {
  return node.children.flatMap((child) => [child, ...descendants(child)]);
}

function flip(value: Tri): Tri {
  return value === "unknown" ? value : !value;
}

/** Whether a node is the compound's element: same part, attributes true for the cell, nested structure true. */
function compoundOnNode(
  compound: ParsedCompoundSelector,
  node: RenderedNode,
  context: StructureContext,
): Tri {
  const part = partOf(compound);
  if (compound.type !== undefined || (compound.lists?.length ?? 0) > 0 || part === undefined) {
    return "unknown";
  }
  if (!context.modelled.has(part) || context.omitted.has(part)) return "unknown";
  if (part !== node.part) return false;
  let result: Tri = true;
  const fold = (value: Tri) => {
    if (value === false) result = false;
    else if (value === "unknown" && result === true) result = "unknown";
  };
  for (const attribute of compound.attributes) {
    if (attribute.name === "data-ui") {
      if (attribute.negated) fold("unknown");
      continue;
    }
    fold(context.attribute(compound, attribute));
  }
  for (const pseudo of compound.pseudos) fold(pseudoOnNode(pseudo, node, context));
  return result;
}

/** Whether the steps match below `from`, each step's combinator relating it to the one before. */
function stepsBelow(
  from: RenderedNode,
  steps: readonly RelativeStep[],
  context: StructureContext,
): Tri {
  const [step, ...rest] = steps;
  if (step.combinator !== ">" && step.combinator !== " ") return "unknown";
  // A step the tree can never answer is unknown even when no candidate exists to ask about.
  if (
    partOf(step.compound) === undefined ||
    step.compound.type !== undefined ||
    !context.modelled.has(partOf(step.compound) ?? "") ||
    context.omitted.has(partOf(step.compound) ?? "")
  ) {
    return "unknown";
  }
  const candidates = step.combinator === ">" ? from.children : descendants(from);
  let result: Tri = false;
  for (const candidate of candidates) {
    const here = compoundOnNode(step.compound, candidate, context);
    if (here === false) continue;
    const onward = rest.length === 0 ? true : stepsBelow(candidate, rest, context);
    const both: Tri = here === true ? onward : onward === false ? false : "unknown";
    if (both === true) return true;
    if (both === "unknown") result = "unknown";
  }
  return result;
}

function pseudoOnNode(pseudo: string, node: RenderedNode, context: StructureContext): Tri {
  const structural: StructuralPseudo | undefined = parseStructuralPseudo(pseudo);
  if (!structural) return "unknown";
  let value: Tri;
  if (structural.kind === "position") {
    const siblings = node.parent?.children;
    // The contract lists the parts it models, not every element; with parts left out, or no parent
    // to look at, the place in the order is not known.
    if (!siblings || context.omitted.size > 0) return "unknown";
    const index = siblings.indexOf(node);
    value =
      structural.position === "first"
        ? index === 0
        : structural.position === "last"
          ? index === siblings.length - 1
          : siblings.length === 1;
  } else {
    value = false;
    for (const steps of structural.alternatives) {
      const found = stepsBelow(node, steps, context);
      if (found === true) {
        value = true;
        break;
      }
      if (found === "unknown") value = "unknown";
    }
    if (structural.alternatives.length === 0) value = "unknown";
  }
  return structural.negated ? flip(value) : value;
}

/**
 * Whether one selector compound's structural pseudo-classes hold in the cell: some element of the
 * compound's part satisfies all of them. For an ancestor compound, only elements that contain the
 * part being resolved count. `false` for anything the tree cannot settle.
 */
export function structuralPseudosHold(input: {
  /** The compound's pseudo-classes that `parseStructuralPseudo` reads. */
  pseudos: readonly string[];
  /** The compound's own part (`[data-ui="x"]`). */
  compound: ParsedCompoundSelector;
  /** The part being resolved, the subject of the whole selector. */
  subjectPart: string;
  /** Whether this compound is the selector's last one (the subject itself). */
  isSubject: boolean;
  tree: RenderedNode;
  context: StructureContext;
}): boolean {
  const { pseudos, compound, subjectPart, isSubject, tree, context } = input;
  const part = partOf(compound);
  if (part === undefined || !context.modelled.has(part) || context.omitted.has(part)) return false;
  const all = [tree, ...descendants(tree)];
  const subjects = all.filter((node) => node.part === subjectPart);
  const candidates = all.filter((node) => node.part === part);
  const eligible = isSubject
    ? candidates
    : candidates.filter((node) => {
        const inside = new Set(descendants(node));
        return subjects.some((subject) => inside.has(subject));
      });
  return eligible.some((node) =>
    pseudos.every((pseudo) => pseudoOnNode(pseudo, node, context) === true),
  );
}
