import postcss, {
  type AtRule,
  type ChildNode,
  type Container,
  type Declaration,
  type Rule,
} from "postcss";
import selectorParser from "postcss-selector-parser";
import { isStateSelector } from "./state-axis";

/** One CSS custom-property declaration, e.g. `background-color: var(--color-primary-brand)`. */
export interface CssDeclaration {
  property: string;
  value: string;
}

/** One parsed rule: a comma-separated selector list sharing one declaration block. */
export interface CssRule {
  /** Each entry is one selector from the comma-separated list, trimmed. */
  selectors: string[];
  declarations: CssDeclaration[];
  /** Wrapping `@media` conditions, outermost first. Empty = unconditional. */
  media: string[];
}

/** Depth-aware split on a top-level character (commas in selector lists, semicolons in decls). */
export function splitTopLevel(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  let quote: '"' | "'" | undefined;
  let escaped = false;
  for (const ch of text) {
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      current += ch;
      escaped = true;
      continue;
    }
    if (quote) {
      current += ch;
      if (ch === quote) quote = undefined;
      continue;
    }
    if (ch === '"' || ch === "'") {
      current += ch;
      quote = ch;
      continue;
    }
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    if (ch === separator && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim().length > 0) parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Selector decomposition
// ---------------------------------------------------------------------------

export interface ParsedAttributeSelector {
  /** e.g. "data-variant". */
  name: string;
  /** The quoted value, or `null` for a bare boolean attribute like `[data-icon-only]`. */
  value: string | null;
  negated?: true;
}

/** One compound selector: attribute selectors + pseudo-classes on a single element. */
export interface ParsedCompoundSelector {
  /**
   * Whatever is on the element besides attributes and pseudo-classes: a tag (`svg`), a class, an
   * id, a combinator the resolver does not follow (`+`, `~`) or an attribute operator it does not
   * evaluate. Undefined when there is nothing else. The resolver never matches a compound that has
   * one, so each of these is refused rather than guessed.
   */
  type?: string;
  attributes: ParsedAttributeSelector[];
  /** Pseudo-classes/elements, e.g. [":hover"] or ["::after"]. */
  pseudos: string[];
  /**
   * Pseudo-classes inside `:not(...)`, e.g. [":focus-visible"] for `:not(:focus-visible)`. Kept
   * apart from `pseudos` because they are the opposite constraint: the compound holds only when
   * none of them does. Omitted when the compound has none.
   */
  negatedPseudos?: string[];
  /**
   * The `:is()` and `:where()` lists on this compound, in source order. Each is kept apart from
   * `pseudos` so the resolver can evaluate it: the compound matches when every list has an
   * argument that matches. Omitted when the compound has none.
   */
  lists?: ParsedMatchList[];
}

/** One `:is()` or `:where()` list. */
export interface ParsedMatchList {
  kind: "is" | "where";
  /** Each argument of the list, as the compounds of one selector. */
  alternatives: ParsedCompoundSelector[][];
}

type SelectorNode = selectorParser.Node;

/** Parses one selector; undefined when it does not parse or is a list. */
function parseSelector(text: string): selectorParser.Selector | undefined {
  try {
    const root = selectorParser().astSync(text);
    return root.nodes.length === 1 ? root.first : undefined;
  } catch {
    return undefined;
  }
}

/** A combinator the resolver follows: a descendant space or a child `>` (both read as "inside"). */
function isStructural(node: SelectorNode): boolean {
  return (
    selectorParser.isCombinator(node) && (node.value.trim() === "" || node.value.trim() === ">")
  );
}

/** The selector's compounds. A combinator the resolver does not follow becomes a compound of its own. */
function groupCompounds(selector: selectorParser.Selector): SelectorNode[][] {
  const groups: SelectorNode[][] = [];
  let current: SelectorNode[] = [];
  const close = () => {
    if (current.length > 0) groups.push(current);
    current = [];
  };
  for (const node of selector.nodes) {
    if (selectorParser.isComment(node)) continue;
    if (isStructural(node)) close();
    else if (selectorParser.isCombinator(node)) {
      close();
      groups.push([node]);
    } else current.push(node);
  }
  close();
  return groups;
}

const textOf = (nodes: SelectorNode[]) => nodes.map(String).join("").trim();

/** Split a full selector into its combinator-separated compound parts (descendant/child). */
export function splitCombinators(selector: string): string[] {
  const parsed = parseSelector(selector);
  if (!parsed) return selector.trim().length > 0 ? [selector.trim()] : [];
  return groupCompounds(parsed).map((group) =>
    selectorParser.isCombinator(group[0]) ? group[0].value.trim() : textOf(group),
  );
}

/** The attribute value as written between its quotes, or null for a bare `[attr]`. */
function attributeValue(attribute: selectorParser.Attribute): string | null {
  if (attribute.value === undefined) return null;
  const raw = attribute.raws.value;
  if (typeof raw === "string" && attribute.quoted) return raw.slice(1, -1);
  return attribute.value;
}

function parseCompoundNodes(nodes: SelectorNode[]): ParsedCompoundSelector {
  const attributes: ParsedAttributeSelector[] = [];
  const pseudos: string[] = [];
  const negatedPseudos: string[] = [];
  const lists: ParsedMatchList[] = [];
  let type = "";
  const addAttribute = (attribute: selectorParser.Attribute, negated: boolean) => {
    // Only `=` is evaluated. `~=`, `^=`, a case flag and the like fall through to `type`, so the
    // rule is refused rather than read as a plain equality.
    if ((attribute.operator && attribute.operator !== "=") || attribute.insensitive) {
      type += String(attribute).trim();
      return;
    }
    const value = attributeValue(attribute);
    attributes.push(
      negated
        ? { name: attribute.attribute, value, negated: true }
        : { name: attribute.attribute, value },
    );
  };
  for (const node of nodes) {
    if (selectorParser.isAttribute(node)) addAttribute(node, false);
    else if (selectorParser.isPseudo(node)) {
      if (node.value.toLowerCase() === ":not") {
        for (const inner of node.nodes.flatMap((entry) => entry.nodes)) {
          if (selectorParser.isAttribute(inner)) addAttribute(inner, true);
          else if (selectorParser.isPseudo(inner)) {
            // `:has()` and the position pseudo-classes are evaluated against the rendered anatomy
            // (`anatomy-match.ts`), so their polarity must survive: `:not(:has(x))` is kept whole.
            // Any other pseudo-class is kept apart as a negated pseudo-class.
            const text = String(inner).trim();
            if (isStructuralPseudoName(inner.value)) pseudos.push(`:not(${text})`);
            else negatedPseudos.push(text);
          } else if (!selectorParser.isComment(inner) && !selectorParser.isCombinator(inner)) {
            type += String(inner).trim();
          }
        }
      } else if (isMatchList(node)) {
        lists.push({
          kind: node.value.toLowerCase() === ":is" ? "is" : "where",
          alternatives: node.nodes.map((argument) =>
            groupCompounds(argument).map(parseCompoundNodes),
          ),
        });
      } else pseudos.push(String(node).trim());
    } else if (selectorParser.isCombinator(node)) type += node.value.trim();
    else if (!selectorParser.isComment(node)) type += String(node).trim();
  }
  return {
    type: type.length > 0 ? type : undefined,
    attributes,
    pseudos,
    ...(negatedPseudos.length > 0 ? { negatedPseudos } : {}),
    ...(lists.length > 0 ? { lists } : {}),
  };
}

/** The pseudo-classes evaluated against a cell's rendered anatomy rather than against an axis. */
const ANATOMY_PSEUDOS = new Set([":has", ":first-child", ":last-child", ":only-child"]);

function isStructuralPseudoName(name: string): boolean {
  return ANATOMY_PSEUDOS.has(name.toLowerCase());
}

/** One step of a `:has()` argument: a compound and how it relates to the step before it. */
export interface RelativeStep {
  /** `>` child, ` ` descendant, `+` next sibling, `~` later sibling. */
  combinator: ">" | " " | "+" | "~";
  compound: ParsedCompoundSelector;
}

/** A `:has()` or position pseudo-class, read from the text `ParsedCompoundSelector.pseudos` holds. */
export type StructuralPseudo =
  | {
      kind: "has";
      negated: boolean;
      /** The comma-separated arguments, each a chain of relative steps. */
      alternatives: RelativeStep[][];
    }
  | { kind: "position"; negated: boolean; position: "first" | "last" | "only" };

/** The steps of one `:has()` argument, keeping the combinators `groupCompounds` folds together. */
function relativeSteps(argument: selectorParser.Selector): RelativeStep[] {
  const steps: RelativeStep[] = [];
  let combinator: RelativeStep["combinator"] = " ";
  let current: SelectorNode[] = [];
  const close = () => {
    if (current.length > 0) steps.push({ combinator, compound: parseCompoundNodes(current) });
    current = [];
    combinator = " ";
  };
  for (const node of argument.nodes) {
    if (selectorParser.isComment(node)) continue;
    if (selectorParser.isCombinator(node)) {
      close();
      const value = node.value.trim();
      combinator = value === ">" || value === "+" || value === "~" ? value : " ";
    } else current.push(node);
  }
  close();
  return steps;
}

const structuralCache = new Map<string, StructuralPseudo | null>();

/**
 * Reads one entry of `ParsedCompoundSelector.pseudos` as a `:has()` or position pseudo-class
 * (`:first-child`, `:last-child`, `:only-child`), or `undefined` for anything else. A `:not()` around
 * one is `negated`. PURE and memoized: the resolver asks once per cell.
 */
export function parseStructuralPseudo(pseudo: string): StructuralPseudo | undefined {
  const cached = structuralCache.get(pseudo);
  if (cached !== undefined) return cached ?? undefined;
  let result: StructuralPseudo | undefined;
  const negated = pseudo.startsWith(":not(");
  const inner = negated ? pseudo.slice(5, -1) : pseudo;
  const lower = inner.toLowerCase();
  if (lower === ":first-child") result = { kind: "position", negated, position: "first" };
  else if (lower === ":last-child") result = { kind: "position", negated, position: "last" };
  else if (lower === ":only-child") result = { kind: "position", negated, position: "only" };
  else if (lower.startsWith(":has(")) {
    const parsed = parseSelector(`x${inner}`);
    const node = parsed?.nodes.find(selectorParser.isPseudo);
    if (node && node.value.toLowerCase() === ":has") {
      result = {
        kind: "has",
        negated,
        alternatives: node.nodes.map(relativeSteps).filter((steps) => steps.length > 0),
      };
    }
  }
  structuralCache.set(pseudo, result ?? null);
  return result;
}

/** Specificity the resolver counts for one pseudo-class: a `:has()` is as specific as its widest argument. */
function pseudoSpecificity(pseudo: string): number {
  const structural = parseStructuralPseudo(pseudo);
  if (structural?.kind !== "has") return 1;
  return Math.max(
    0,
    ...structural.alternatives.map((steps) =>
      steps.reduce((sum, step) => sum + compoundSpecificity(step.compound), 0),
    ),
  );
}

/** `:is(...)` or `:where(...)`: a list the resolver evaluates argument by argument. */
function isMatchList(node: selectorParser.Pseudo): boolean {
  const name = node.value.toLowerCase();
  return name === ":is" || name === ":where";
}

/**
 * Parse one compound selector segment (no combinators) into its constituent
 * parts. An attribute inside `:not()` becomes a `negated: true` entry in `attributes` — the
 * OPPOSITE constraint from the same attribute outside `:not()` — so
 * `matchRuleForCell` can require it to be absent/unequal rather than present.
 * A pseudo-class inside `:not()` (e.g. `:not(:focus-visible)`) becomes a
 * `negatedPseudos` entry; the resolver can answer it only for a cell that has a
 * State axis, and refuses the rule otherwise. A pseudo-class with an argument
 * (`:nth-child(2)`) is one token, verbatim.
 */
export function parseCompoundSelector(compound: string): ParsedCompoundSelector {
  const parsed = parseSelector(compound);
  if (!parsed) return { type: compound.trim() || undefined, attributes: [], pseudos: [] };
  return parseCompoundNodes(parsed.nodes.filter((node) => !isStructural(node)));
}

/**
 * Memoized decomposition of a full selector. The resolver re-runs it for the SAME selector string
 * once per cartesian variant cell, so caching avoids reparsing identical text thousands of times.
 * PURE: a function of the string alone.
 */
const parsedSelectorCache = new Map<string, ParsedCompoundSelector[]>();

export function parseSelectorCompounds(selector: string): ParsedCompoundSelector[] {
  const cached = parsedSelectorCache.get(selector);
  if (cached) return cached;
  const parsed = parseSelector(selector);
  const compounds: ParsedCompoundSelector[] = parsed
    ? groupCompounds(parsed).map(parseCompoundNodes)
    : selector.trim().length > 0
      ? [{ type: selector.trim(), attributes: [], pseudos: [] }]
      : [];
  parsedSelectorCache.set(selector, compounds);
  return compounds;
}

// ---------------------------------------------------------------------------
// Evaluating :is() and :where()
// ---------------------------------------------------------------------------

/** What an argument the resolver cannot read as one compound becomes: a type nothing matches. */
const UNREADABLE_ARGUMENT = "(an argument with a combinator)";

/** Specificity of one compound as the resolver counts it: attributes and pseudo-classes, plus lists. */
function compoundSpecificity(compound: ParsedCompoundSelector): number {
  let total =
    compound.attributes.length +
    compound.pseudos.reduce((sum, pseudo) => sum + pseudoSpecificity(pseudo), 0) +
    (compound.negatedPseudos?.length ?? 0);
  for (const list of compound.lists ?? []) {
    // `:where()` adds nothing; `:is()` adds its most specific argument, whichever one matches.
    if (list.kind === "where") continue;
    total += Math.max(
      0,
      ...list.alternatives.map((argument) =>
        argument.reduce((sum, entry) => sum + compoundSpecificity(entry), 0),
      ),
    );
  }
  return total;
}

function mergeCompounds(
  base: ParsedCompoundSelector,
  extra: ParsedCompoundSelector,
): ParsedCompoundSelector {
  const type = `${base.type ?? ""}${extra.type ?? ""}`;
  return {
    type: type.length > 0 ? type : undefined,
    attributes: [...base.attributes, ...extra.attributes],
    pseudos: [...base.pseudos, ...extra.pseudos],
    ...(base.negatedPseudos || extra.negatedPseudos
      ? { negatedPseudos: [...(base.negatedPseudos ?? []), ...(extra.negatedPseudos ?? [])] }
      : {}),
  };
}

/** The plain compounds a compound stands for: `X:is(a, b)` is `Xa` and `Xb`. */
function expandCompound(compound: ParsedCompoundSelector): ParsedCompoundSelector[] {
  let variants: ParsedCompoundSelector[] = [
    {
      type: compound.type,
      attributes: compound.attributes,
      pseudos: compound.pseudos,
      ...(compound.negatedPseudos ? { negatedPseudos: compound.negatedPseudos } : {}),
    },
  ];
  for (const list of compound.lists ?? []) {
    const pieces = list.alternatives.flatMap((argument) =>
      argument.length === 1
        ? expandCompound(argument[0])
        : [{ type: UNREADABLE_ARGUMENT, attributes: [], pseudos: [] }],
    );
    variants = variants.flatMap((base) => pieces.map((piece) => mergeCompounds(base, piece)));
  }
  return variants;
}

/** A selector as the plain selectors it stands for, with the specificity the browser gives it. */
export interface SelectorVariants {
  /** The resolver's specificity: attributes and pseudo-classes, `:is()` at its widest argument, `:where()` at zero. */
  specificity: number;
  /** Every selector the original expands to, each a list of plain compounds. */
  variants: ParsedCompoundSelector[][];
}

const variantsCache = new Map<string, SelectorVariants>();

/**
 * Memoized expansion of a full selector: every `:is()` and `:where()` replaced by each of its
 * arguments in turn. All the variants share one specificity (the original's), because the browser
 * gives the selector one regardless of which argument matched. PURE: a function of the string.
 */
export function parseSelectorVariants(selector: string): SelectorVariants {
  const cached = variantsCache.get(selector);
  if (cached) return cached;
  const compounds = parseSelectorCompounds(selector);
  const specificity = compounds.reduce((sum, entry) => sum + compoundSpecificity(entry), 0);
  const variants = compounds.reduce<ParsedCompoundSelector[][]>(
    (rows, compound) => {
      const options = expandCompound(compound);
      return rows.flatMap((row) => options.map((option) => [...row, option]));
    },
    [[]],
  );
  const result = { specificity, variants: compounds.length === 0 ? [] : variants };
  variantsCache.set(selector, result);
  return result;
}

// ---------------------------------------------------------------------------
// Flattening native nesting and :is()
// ---------------------------------------------------------------------------

type Specificity = [number, number, number];

const compareSpecificity = (a: Specificity, b: Specificity) =>
  a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

const PSEUDO_ELEMENTS = new Set([":before", ":after", ":first-line", ":first-letter"]);
const SPECIFICITY_ARGUMENT_PSEUDOS = new Set([":is", ":not", ":has", ":matches"]);

/** Selector specificity (ids, classes/attributes/pseudo-classes, tags/pseudo-elements). */
function specificityOf(selector: selectorParser.Selector): Specificity {
  const total: Specificity = [0, 0, 0];
  for (const node of selector.nodes) {
    if (selectorParser.isIdentifier(node)) total[0]++;
    else if (selectorParser.isClassName(node) || selectorParser.isAttribute(node)) total[1]++;
    else if (selectorParser.isTag(node)) total[2]++;
    else if (selectorParser.isPseudo(node)) {
      const name = node.value.toLowerCase();
      if (name.startsWith("::") || PSEUDO_ELEMENTS.has(name)) total[2]++;
      else if (name === ":where") continue;
      else if (SPECIFICITY_ARGUMENT_PSEUDOS.has(name)) {
        const widest = node.nodes.map(specificityOf).sort(compareSpecificity).at(-1);
        if (widest) for (let i = 0; i < 3; i++) total[i] += widest[i];
      } else total[1]++;
    }
  }
  return total;
}

type Refusal = { reason: string };

const unreadable = (text: string): Refusal => ({
  reason: `\`${text.trim()}\` is not a selector the compiler can read.`,
});

/** `&` and implicit nesting replaced by `parent`, or why that cannot be done exactly. */
function nestInto(child: string, parent: string): string | Refusal {
  const selector = parseSelector(child);
  if (!selector) return unreadable(child);
  const nestings: selectorParser.Nesting[] = [];
  selector.walkNesting((node) => {
    nestings.push(node);
  });
  if (nestings.length === 0) return `${parent} ${child.trim()}`;
  const parentSelector = parseSelector(parent);
  const compoundParent =
    parentSelector !== undefined && groupCompounds(parentSelector).length === 1;
  for (const nesting of nestings) {
    if (!compoundParent) {
      // A complex parent substitutes exactly only where `&` is the leading compound of the
      // selector (`& .x`, `& > .x`); after another compound or a combinator (`.c &`, `.c > &`)
      // the meaning is `:is(<parent>)`, which flattening would change.
      const startsSelector = nesting.parent === selector && !nesting.prev();
      if (!startsSelector) {
        return {
          reason: `\`&\` in \`${child.trim()}\` follows other selectors or a combinator, but its parent \`${parent}\` has a combinator.`,
        };
      }
    }
    nesting.value = parent;
  }
  return selector.toString().trim();
}

function hasNesting(text: string): boolean {
  if (!text.includes("&")) return false;
  let found = false;
  parseSelector(text)?.walkNesting(() => {
    found = true;
  });
  return found;
}

/** The flat selector list for a rule, given the selectors it is nested in (null at the top level). */
function resolveSelectors(
  list: string[],
  parents: string[] | null,
): { selectors: string[] } | Refusal {
  if (parents === null) {
    for (const entry of list) {
      if (hasNesting(entry)) {
        return { reason: `\`&\` in \`${entry}\` is outside any rule it could refer to.` };
      }
    }
    return { selectors: list };
  }
  const widths = parents.map((parent) => {
    const parsed = parseSelector(parent);
    return parsed ? specificityOf(parsed) : ([0, 0, 0] as Specificity);
  });
  if (widths.some((width) => compareSpecificity(width, widths[0]) !== 0)) {
    return {
      reason: `nested under a selector list whose entries differ in specificity (\`${parents.join(", ")}\`), which flattening would change.`,
    };
  }
  const selectors: string[] = [];
  for (const parent of parents) {
    for (const entry of list) {
      const nested = nestInto(entry, parent);
      if (typeof nested !== "string") return nested;
      selectors.push(nested);
    }
  }
  return { selectors };
}

// ---------------------------------------------------------------------------
// Stylesheet walk
// ---------------------------------------------------------------------------

/** One place a stylesheet leaves the supported style. */
export interface UnsupportedCss {
  /** 1-based line of the offending rule. */
  line: number;
  /** What was found and why the compiler will not guess its meaning. */
  reason: string;
}

/** A selector the resolver reads only in part: the rule is kept, but it never reaches a variant cell. */
export interface SkippedSelector {
  /** 1-based line of the rule. */
  line: number;
  /** The selector, whitespace collapsed. */
  selector: string;
  /** Each construct in it the compiler does not evaluate, and why. */
  reasons: string[];
  /**
   * The subset of `reasons` a contract's anatomy can settle (`:has()` and the position
   * pseudo-classes), so a caller that knows the anatomy can drop them.
   */
  anatomyReasons: string[];
  /** The `data-ui` parts the selector's subject can be, so a caller can tell if it touches a part it models. */
  targets: string[];
}

interface Analysis {
  rules: CssRule[];
  unsupported: UnsupportedCss[];
  skipped: SkippedSelector[];
}

/** Pseudo-classes whose truth depends on a node's place among its siblings, which the compiler never sees. */
const STRUCTURAL_PSEUDOS = new Set([
  ":first-child",
  ":last-child",
  ":only-child",
  ":first-of-type",
  ":last-of-type",
  ":only-of-type",
  ":nth-child",
  ":nth-last-child",
  ":nth-of-type",
  ":nth-last-of-type",
  ":empty",
]);

/**
 * A `:not()` over a state pseudo-class (`:not(:focus-visible)`) can be checked only against a cell
 * that has the standard State axis, which says which state the cell is in.
 */
const STATE_NOT_REASON =
  "`:not()` over a state pseudo-class can only be checked against a State axis";

/**
 * What a selector uses that the resolver cannot evaluate, and which parts it is aimed at. The
 * state pseudo-classes (`:hover`, `:focus-visible`, `:disabled`) are not listed: a component with
 * no axis for a state leaves them out by design.
 */
function skippedConstructs(text: string): {
  reasons: string[];
  anatomyReasons: string[];
  targets: string[];
} {
  const selector = parseSelector(text);
  if (!selector) return { reasons: [], anatomyReasons: [], targets: [] };
  const reasons = new Set<string>();
  const anatomyReasons = new Set<string>();
  selector.walk((node) => {
    if (selectorParser.isPseudo(node)) {
      const name = node.value.toLowerCase();
      if (name === ":has") {
        const reason =
          "`:has()` looks at what an element contains, which the compiler reads only from a contract's anatomy";
        reasons.add(reason);
        anatomyReasons.add(reason);
      } else if (name === ":not") {
        const isAttribute = (inner: selectorParser.Node) =>
          selectorParser.isAttribute(inner) &&
          (!inner.operator || inner.operator === "=") &&
          !inner.insensitive;
        const isState = (inner: selectorParser.Node) =>
          selectorParser.isPseudo(inner) && isStateSelector(String(inner));
        // Evaluated from the anatomy; the pseudo-class itself is reported on its own.
        const isAnatomyPseudo = (inner: selectorParser.Node) =>
          selectorParser.isPseudo(inner) && isStructuralPseudoName(inner.value);
        const inners = node.nodes.flatMap((argument) => argument.nodes);
        if (
          !inners.every((inner) => isAttribute(inner) || isState(inner) || isAnatomyPseudo(inner))
        ) {
          reasons.add(
            "`:not()` with more than attribute selectors cannot be checked against a variant",
          );
        } else if (inners.some(isState)) {
          reasons.add(STATE_NOT_REASON);
        }
      } else if (STRUCTURAL_PSEUDOS.has(name)) {
        const reason = `\`${name}\` depends on an element's position, which the compiler reads only from a contract's anatomy`;
        reasons.add(reason);
        if (isStructuralPseudoName(name)) anatomyReasons.add(reason);
      } else if (name === ":is" || name === ":where") {
        if (node.nodes.some((argument) => groupCompounds(argument).length > 1)) {
          reasons.add(`\`${name}()\` has an argument with a combinator, which is not evaluated`);
        }
      }
    } else if (selectorParser.isCombinator(node) && !isStructural(node)) {
      reasons.add(`the \`${node.value.trim()}\` combinator is not followed`);
    } else if (selectorParser.isClassName(node) || selectorParser.isIdentifier(node)) {
      reasons.add("class and id selectors are not evaluated");
    } else if (selectorParser.isAttribute(node)) {
      if ((node.operator && node.operator !== "=") || node.insensitive) {
        reasons.add(`the \`${String(node).trim()}\` attribute match is not evaluated`);
      }
    }
  });
  const targets = new Set<string>();
  for (const variant of parseSelectorVariants(text).variants) {
    const subject = variant.at(-1);
    for (const attribute of subject?.attributes ?? []) {
      if (attribute.name === "data-ui" && !attribute.negated && attribute.value !== null) {
        targets.add(attribute.value);
      }
    }
  }
  return { reasons: [...reasons], anatomyReasons: [...anatomyReasons], targets: [...targets] };
}

const KEYFRAMES = /^(?:-webkit-)?keyframes$/i;

/** `@name params` as written. */
const preludeOf = (at: AtRule) =>
  `@${at.name}${at.params ? `${at.raws.afterName ?? " "}${at.params}` : ""}`.trim();

function declarationOf(node: Declaration): CssDeclaration | undefined {
  const value =
    `${node.value}${node.important ? (node.raws.important ?? " !important") : ""}`.trim();
  return node.prop && value ? { property: node.prop, value } : undefined;
}

function analyzeCss(source: string): Analysis {
  const rules: CssRule[] = [];
  const unsupported: UnsupportedCss[] = [];
  const skipped: SkippedSelector[] = [];
  let root: postcss.Root;
  try {
    root = postcss.parse(source);
  } catch (error) {
    if (error instanceof postcss.CssSyntaxError) {
      return {
        rules,
        unsupported: [{ line: error.line ?? 1, reason: `CSS syntax error: ${error.reason}.` }],
        skipped: [],
      };
    }
    throw error;
  }
  const refuse = (node: ChildNode, reason: string) =>
    unsupported.push({ line: node.source?.start?.line ?? 1, reason });

  const walk = (container: Container, selectors: string[] | null, media: string[]) => {
    let run: CssDeclaration[] = [];
    // A run of declarations ends where a nested rule starts, so cascade order follows the source.
    const flush = () => {
      if (selectors && run.length > 0) rules.push({ selectors, declarations: run, media });
      run = [];
    };
    for (const node of container.nodes ?? []) {
      if (node.type === "decl") {
        if (!selectors) {
          const text = `${node.toString().trim()};`;
          refuse(
            node,
            `\`${text.length > 60 ? `${text.slice(0, 57)}...` : text}\` is outside any rule and is not supported.`,
          );
          continue;
        }
        const declaration = declarationOf(node);
        if (declaration) run.push(declaration);
      } else if (node.type === "rule") {
        flush();
        walkRule(node, selectors, media);
      } else if (node.type === "atrule") {
        flush();
        walkAtRule(node, selectors, media);
      }
    }
    flush();
  };

  const walkRule = (rule: Rule, parents: string[] | null, media: string[]) => {
    const flat = resolveSelectors(rule.selectors, parents);
    if ("reason" in flat) {
      refuse(rule, flat.reason);
      return;
    }
    for (const selector of flat.selectors) {
      const found = skippedConstructs(selector);
      if (found.reasons.length === 0) continue;
      skipped.push({
        line: rule.source?.start?.line ?? 1,
        selector: selector.replace(/\s+/g, " ").trim(),
        ...found,
      });
    }
    if (!(rule.nodes ?? []).some((child) => child.type !== "comment")) {
      rules.push({ selectors: flat.selectors, declarations: [], media });
      return;
    }
    walk(rule, flat.selectors, media);
  };

  const walkAtRule = (at: AtRule, selectors: string[] | null, media: string[]) => {
    const name = at.name.toLowerCase();
    const block = at.nodes;
    if (name === "layer" || name === "media") {
      if (!block) {
        refuse(at, `\`@${at.name}\` without a block is not supported; use the block form.`);
        return;
      }
      walk(at, selectors, name === "media" ? [...media, at.params] : media);
      return;
    }
    if (KEYFRAMES.test(name)) {
      if (!block) {
        refuse(at, `\`@${at.name}\` without a block is not supported; use the block form.`);
        return;
      }
      const tagged = [...media, preludeOf(at)];
      for (const step of block) {
        if (step.type !== "rule") continue;
        rules.push({
          selectors: step.selectors,
          declarations: (step.nodes ?? []).flatMap((child) =>
            child.type === "decl" ? (declarationOf(child) ?? []) : [],
          ),
          media: tagged,
        });
      }
      return;
    }
    refuse(
      at,
      name === "container"
        ? "`@container` is not supported: its condition depends on the size of a rendered container, which a static plan cannot evaluate."
        : `\`@${at.name}\` is not a supported at-rule.`,
    );
    if (block) walk(at, selectors, [...media, preludeOf(at)]);
  };

  walk(root, null, []);
  return { rules, unsupported, skipped };
}

const analysisCache = new Map<string, Analysis>();

function analysisOf(source: string): Analysis {
  let analysis = analysisCache.get(source);
  if (!analysis) {
    analysis = analyzeCss(source);
    analysisCache.set(source, analysis);
  }
  return analysis;
}

/** PURE. Parse a component's co-located CSS into a flat list of rules. */
export function parseComponentCss(source: string): CssRule[] {
  // Copies, so a caller that edits a rule never changes what the next caller reads.
  return analysisOf(source).rules.map((rule) => ({
    selectors: [...rule.selectors],
    declarations: rule.declarations.map((declaration) => ({ ...declaration })),
    media: [...rule.media],
  }));
}

/**
 * PURE. Finds the constructs the compiler would otherwise read wrongly without saying so: at-rules
 * other than `@layer`, `@media` and `@keyframes` (including `@container`), declarations outside
 * any rule, selectors that cannot be flattened exactly, and CSS that does not parse. The compiler
 * refuses these with `css-unsupported` instead of guessing.
 */
export function findUnsupportedCss(source: string): UnsupportedCss[] {
  return analysisOf(source).unsupported.map((entry) => ({ ...entry }));
}

/**
 * PURE. The rules whose selectors use something the compiler does not evaluate, so the rule is
 * kept but never reaches a variant cell: `:has()`, a `:not()` with more than attribute selectors,
 * structural pseudo-classes, a combinator it does not follow, a class or id, an attribute
 * operator other than `=`, and an `:is()` or `:where()` argument with a combinator. Each entry
 * names the parts the selector's subject can be, so a caller can keep only those it models.
 * `evaluatesState` is for a component that has the State axis: a `:not()` over a state
 * pseudo-class is then evaluated and not reported.
 */
export function findSkippedSelectors(
  source: string,
  options: { evaluatesState?: boolean } = {},
): SkippedSelector[] {
  return analysisOf(source).skipped.flatMap((entry) => {
    // With a State axis the resolver answers a `:not()` over a state pseudo-class, so it is not skipped.
    const reasons = options.evaluatesState
      ? entry.reasons.filter((reason) => reason !== STATE_NOT_REASON)
      : [...entry.reasons];
    if (reasons.length === 0) return [];
    return [
      {
        ...entry,
        reasons,
        anatomyReasons: [...entry.anatomyReasons],
        targets: [...entry.targets],
      },
    ];
  });
}
