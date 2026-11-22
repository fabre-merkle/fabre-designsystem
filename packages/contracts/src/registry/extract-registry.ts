import ts from "typescript";
import { refusal } from "../generation-contract/diagnostics";
import { type CssRule, parseComponentCss } from "./css-parser";
import {
  COMPONENT_REGISTRY_SCHEMA_VERSION,
  type ComponentRegistryAxis,
  type ComponentRegistryEntry,
} from "./types";

const VARIANT_PROP_HINTS = new Set([
  "variant",
  "size",
  "mode",
  "tone",
  "intent",
  "kind",
  "color",
  "weight",
  "orientation",
]);

/** Map a local union type name to its prop name: `ButtonVariant` → `variant`. */
function propNameFromType(typeName: string): string {
  const last = typeName.match(/[A-Z][a-z0-9]*$/)?.[0] ?? typeName;
  return last.charAt(0).toLowerCase() + last.slice(1);
}

/** A parsed component file and, once a type needs it, a checker over it and the files it imports. */
interface SourceContext {
  file: ts.SourceFile;
  path: string;
  checker?: ts.TypeChecker;
}

const VIRTUAL_PATH = "/component.tsx";

const COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.Preserve,
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  types: [],
  lib: ["lib.es5.d.ts"],
};

/** Parsed default-library files, shared by every program in the process. */
const libraryFiles = new Map<string, ts.SourceFile>();

/** The checker for a component file. Only relative imports resolve; a package import stays unresolved. */
function checkerOf(context: SourceContext): ts.TypeChecker {
  if (context.checker) return context.checker;
  const host = ts.createCompilerHost(COMPILER_OPTIONS, true);
  const { getSourceFile, fileExists, readFile } = host;
  host.getSourceFile = (name, ...rest) => {
    if (name === context.path) return context.file;
    if (!name.includes("/typescript/lib/")) return getSourceFile.call(host, name, ...rest);
    let library = libraryFiles.get(name);
    if (!library) {
      library = getSourceFile.call(host, name, ...rest);
      if (library) libraryFiles.set(name, library);
    }
    return library;
  };
  host.fileExists = (name) => name === context.path || fileExists.call(host, name);
  host.readFile = (name) => (name === context.path ? context.file.text : readFile.call(host, name));
  host.resolveModuleNameLiterals = (literals, containingFile, _redirected, options) =>
    literals.map((literal) => ({
      // Without a real path a relative import has nothing to resolve against.
      resolvedModule:
        context.path !== VIRTUAL_PATH && literal.text.startsWith(".")
          ? ts.resolveModuleName(literal.text, containingFile, options, host).resolvedModule
          : undefined,
    }));
  const program = ts.createProgram({ rootNames: [context.path], options: COMPILER_OPTIONS, host });
  context.checker = program.getTypeChecker();
  return context.checker;
}

const contexts = new Map<string, SourceContext>();

/**
 * The component file as a syntax tree. Parse diagnostics are ignored (a fragment such as a bare
 * JSX element still parses). Parsed once per path and text.
 */
function parseSource(source: string, sourcePath: string | undefined): SourceContext {
  const path = sourcePath ?? VIRTUAL_PATH;
  const key = `${path}\0${source}`;
  let context = contexts.get(key);
  if (!context) {
    const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    context = { file, path };
    contexts.set(key, context);
  }
  return context;
}

type FunctionLike = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction;
type TypeMembers = ts.NodeArray<ts.TypeElement>;

/** Strips parentheses, type assertions and non-null operators from an expression. */
function unwrapExpression(expression: ts.Expression): ts.Expression {
  let node = expression;
  while (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isNonNullExpression(node)
  ) {
    node = node.expression;
  }
  return node;
}

/** Whether a call is a component wrapper such as `forwardRef` or `memo`. */
function isComponentWrapper(callee: ts.Expression): boolean {
  let name: string | undefined;
  if (ts.isIdentifier(callee)) name = callee.text;
  else if (
    ts.isPropertyAccessExpression(callee) &&
    ts.isIdentifier(callee.expression) &&
    callee.expression.text === "React"
  ) {
    name = callee.name.text;
  }
  return name === "forwardRef" || name === "memo";
}

/** The function that renders a variable's component: its initializer, or the callback a `forwardRef`/`memo` wraps. */
function componentFunction(expression: ts.Expression | undefined): FunctionLike | undefined {
  if (!expression) return undefined;
  const node = unwrapExpression(expression);
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return node;
  if (ts.isCallExpression(node) && isComponentWrapper(node.expression)) {
    return componentFunction(node.arguments[0]);
  }
  return undefined;
}

/**
 * The function that renders the top-level component called `name`: `function Name`, `const Name =
 * (…) =>`, `const Name = function …`, or either wrapped in `forwardRef` / `memo`. A function
 * declaration wins over a variable of the same name. Names compare without case and hyphens, so a
 * component name (`ToggleGroup`) and a slug (`toggle-group`) both find `function ToggleGroup`.
 */
function declarationOf(sf: ts.SourceFile, name: string): FunctionLike | undefined {
  const normalize = (text: string) => text.replace(/-/g, "").toLowerCase();
  const wanted = normalize(name);
  let declared: ts.FunctionDeclaration | undefined;
  let variable: ts.VariableDeclaration | undefined;
  for (const statement of sf.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      if (normalize(statement.name.text) !== wanted) continue;
      if (!declared || (!declared.body && statement.body)) declared = statement;
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && normalize(declaration.name.text) === wanted) {
          variable ??= declaration;
        }
      }
    }
  }
  return declared ?? componentFunction(variable?.initializer);
}

/** The text of a property name written as an identifier or a quoted or numeric literal. */
function propertyNameText(name: ts.PropertyName | ts.BindingName): string | undefined {
  return ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNoSubstitutionTemplateLiteral(name) ||
    ts.isNumericLiteral(name)
    ? name.text
    : undefined;
}

const PROPS_WRAPPERS = new Set(["Partial", "Readonly", "Required"]);

/**
 * The members of a local `interface Name` / `type Name = ...` and of the local types it extends or
 * intersects.
 */
function localTypeBodies(sf: ts.SourceFile, name: string, seen: Set<string>): TypeMembers[] {
  if (seen.has(name)) return [];
  seen.add(name);
  for (const statement of sf.statements) {
    if (ts.isTypeAliasDeclaration(statement) && statement.name.text === name) {
      return typeExpressionBodies(sf, statement.type, seen);
    }
    if (ts.isInterfaceDeclaration(statement) && statement.name.text === name) {
      const bodies = [statement.members];
      for (const clause of statement.heritageClauses ?? []) {
        if (clause.token !== ts.SyntaxKind.ExtendsKeyword) continue;
        for (const parent of clause.types) {
          if (!ts.isIdentifier(parent.expression)) continue;
          const parentName = parent.expression.text;
          const [inner] = parent.typeArguments ?? [];
          if (!parent.typeArguments) {
            bodies.push(...localTypeBodies(sf, parentName, seen));
          } else if (PROPS_WRAPPERS.has(parentName) && inner) {
            // `extends Partial<Base>` reads `Base` the same way the alias form `= Partial<Base>` does.
            bodies.push(...typeExpressionBodies(sf, inner, seen));
          }
        }
      }
      return bodies;
    }
  }
  return [];
}

/** Props-type members named by a type expression: `{...}` literals, local names and their `&` intersections. */
function typeExpressionBodies(
  sf: ts.SourceFile,
  node: ts.TypeNode,
  seen: Set<string>,
): TypeMembers[] {
  if (ts.isParenthesizedTypeNode(node)) return typeExpressionBodies(sf, node.type, seen);
  if (ts.isIntersectionTypeNode(node)) {
    return node.types.flatMap((part) => typeExpressionBodies(sf, part, seen));
  }
  if (ts.isTypeLiteralNode(node)) return [node.members];
  if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) {
    const name = node.typeName.text;
    const [inner] = node.typeArguments ?? [];
    if (PROPS_WRAPPERS.has(name) && inner) return typeExpressionBodies(sf, inner, seen);
    if (!node.typeArguments) return localTypeBodies(sf, name, seen);
  }
  return [];
}

/**
 * The property members of the props type annotated on the first parameter of the component's own
 * declaration (by name, or `Root`): its interface or type literal and any `&` intersections or
 * `extends` of local types. Undefined when no annotation resolves to a local type.
 */
function propsBodiesOf(sf: ts.SourceFile, componentName: string): TypeMembers[] | undefined {
  for (const candidate of [componentName, "Root"]) {
    const declaration = declarationOf(sf, candidate);
    const annotation = declaration?.parameters[0]?.type;
    if (!annotation) continue;
    const bodies = typeExpressionBodies(sf, annotation, new Set());
    return bodies.length > 0 ? bodies : undefined;
  }
  return undefined;
}

/** Whether a prop's type is `typeName`, alone or as a member of a union or intersection. */
function referencesType(node: ts.TypeNode, typeName: string): boolean {
  if (ts.isParenthesizedTypeNode(node)) return referencesType(node.type, typeName);
  if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
    return node.types.some((part) => referencesType(part, typeName));
  }
  return (
    ts.isTypeReferenceNode(node) &&
    ts.isIdentifier(node.typeName) &&
    node.typeName.text === typeName
  );
}

/**
 * The axis props a union type drives (none when it is not an axis). Classified by the props it is
 * used on within the selected component's own props type, so a `type FooVariant` used on a
 * controlled `value` prop is not an axis, and a sibling component's props are never read. A type
 * the props type does not use falls back to the prop its name implies (`ButtonVariant` →
 * `variant`).
 */
function axisPropsOf(typeName: string, propsBodies: TypeMembers[] | undefined): string[] {
  const usedOn = (propsBodies ?? []).flatMap((members) =>
    members.flatMap((member) => {
      if (!ts.isPropertySignature(member) || !member.type) return [];
      const prop = propertyNameText(member.name);
      return prop !== undefined && referencesType(member.type, typeName) ? [prop] : [];
    }),
  );
  if (usedOn.length === 0) {
    const named = propNameFromType(typeName);
    return VARIANT_PROP_HINTS.has(named) ? [named] : [];
  }
  return [...new Set(usedOn.filter((prop) => VARIANT_PROP_HINTS.has(prop)))];
}

/** `a`, `a.b` or `a?.b.c`: the operands a nullish default chain may fall through. */
function isNameChain(node: ts.Expression): boolean {
  if (ts.isIdentifier(node) || node.kind === ts.SyntaxKind.ThisKeyword) return true;
  return ts.isPropertyAccessExpression(node) && isNameChain(node.expression);
}

/** The literal a `prop ?? a?.b ?? "literal"` chain ends in, when `expression` is exactly that. */
function nullishChainLiteral(expression: ts.Expression, prop: string): string | undefined {
  const operands: ts.Expression[] = [];
  let node = expression;
  while (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
  ) {
    operands.unshift(node.right);
    node = node.left;
  }
  operands.unshift(node);
  const first = operands[0];
  const last = operands[operands.length - 1];
  if (operands.length < 2 || !ts.isIdentifier(first) || first.text !== prop) return undefined;
  if (!ts.isStringLiteral(last)) return undefined;
  return operands.slice(1, -1).every(isNameChain) ? last.text : undefined;
}

/** The first `= prop ?? … ?? "literal"` (a declaration initializer or an assignment) in `root`, in source order. */
function firstNullishDefault(root: ts.Node, prop: string): string | undefined {
  let found: string | undefined;
  const visit = (node: ts.Node) => {
    if (found !== undefined) return;
    let assigned: ts.Expression | undefined;
    if (ts.isVariableDeclaration(node)) assigned = node.initializer;
    else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      assigned = node.right;
    }
    if (assigned) found = nullishChainLiteral(assigned, prop);
    if (found === undefined) ts.forEachChild(node, visit);
  };
  visit(root);
  return found;
}

/**
 * The value the component renders when a caller omits `prop`: its React default. Read only from
 * the component's own declaration, found by name (`Button`, or `Root` for a compound component
 * such as Select): a destructuring default with a string literal in its first parameter
 * (`size = "md"`), or a nullish chain assigned to a binding in its own body that ends in a literal
 * (`const resolved = size ?? group?.size ?? "md"`, which may span lines). Nothing else counts: a
 * default in another function, a JSX attribute, or a component that delegates to a `Root` that has
 * one. Returns undefined when the declaration does not state one among the axis values.
 */
function reactDefault(
  sf: ts.SourceFile,
  prop: string,
  values: string[],
  componentName: string,
): string | undefined {
  for (const candidate of [componentName, "Root"]) {
    const declaration = declarationOf(sf, candidate);
    if (!declaration) continue;
    const first = declaration.parameters[0]?.name;
    if (first && ts.isObjectBindingPattern(first)) {
      for (const element of first.elements) {
        const literal = element.initializer;
        if (
          !element.dotDotDotToken &&
          propertyNameText(element.propertyName ?? element.name) === prop &&
          literal &&
          ts.isStringLiteral(literal) &&
          values.includes(literal.text)
        ) {
          return literal.text;
        }
      }
    }
    // The chain must sit in this component's own body. An expression body holds no assignment,
    // and nothing outside the function is read.
    const body = declaration.body;
    if (!body || !ts.isBlock(body)) return undefined;
    const found = firstNullishDefault(body, prop);
    return found !== undefined && values.includes(found) ? found : undefined;
  }
  return undefined;
}

/** Strips redundant parentheses from a type node. */
const unparenthesized = (node: ts.TypeNode): ts.TypeNode =>
  ts.isParenthesizedTypeNode(node) ? unparenthesized(node.type) : node;

/** The string a literal node holds, when it is a string literal or a template without substitutions. */
const stringOf = (node: ts.Node): string | undefined =>
  ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : undefined;

/** The string elements of an `as const` array, or the keys or values of an object, in source order. */
function constantEntries(
  expression: ts.Expression | undefined,
  read: "elements" | "keys" | "values",
): string[] {
  if (!expression) return [];
  const node = unwrapExpression(expression);
  if (read === "elements" && ts.isArrayLiteralExpression(node)) {
    return node.elements.flatMap((element) => stringOf(element) ?? []);
  }
  if (read !== "elements" && ts.isObjectLiteralExpression(node)) {
    return node.properties.flatMap((property) => {
      if (!ts.isPropertyAssignment(property)) return [];
      if (read === "values") return stringOf(property.initializer) ?? [];
      return propertyNameText(property.name) ?? [];
    });
  }
  return [];
}

/** The declaration a name resolves to, following an import to the file that declares it. */
function declarationOfName(context: SourceContext, name: ts.Node): ts.Declaration | undefined {
  const checker = checkerOf(context);
  let symbol = checker.getSymbolAtLocation(name);
  if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  return symbol?.valueDeclaration ?? symbol?.declarations?.[0];
}

/**
 * The string literals a type node names, in the order they are written. A union reads straight
 * from its members; a reference to another union, an imported one, `(typeof ARR)[number]` over an
 * `as const` array and `keyof typeof OBJ` follow to where they are declared. The checker only
 * decides which values a derived type (`Exclude<A, "x">`) keeps, so the order never depends on how
 * the checker numbers its types.
 */
function writtenLiterals(
  context: SourceContext,
  node: ts.TypeNode,
  seen: Set<ts.Node> = new Set(),
  /** The literals each type parameter of the alias being read stands for. */
  bound: ReadonlyMap<string, string[]> = new Map(),
): string[] {
  const type = unparenthesized(node);
  if (seen.has(type)) return [];
  seen.add(type);
  try {
    return readWritten(context, type, seen, bound);
  } finally {
    // Only a cycle is skipped: the same generic body is read again for another set of arguments.
    seen.delete(type);
  }
}

/** The standard utilities that keep the written order of their first type argument. */
const FILTERING_UTILITIES = new Set(["Exclude", "Extract", "NonNullable"]);

function readWritten(
  context: SourceContext,
  type: ts.TypeNode,
  seen: Set<ts.Node>,
  bound: ReadonlyMap<string, string[]>,
): string[] {
  if (ts.isUnionTypeNode(type)) {
    return type.types.flatMap((member) => writtenLiterals(context, member, seen, bound));
  }
  if (ts.isLiteralTypeNode(type)) {
    const literal = stringOf(type.literal);
    return literal === undefined ? [] : [literal];
  }
  if (ts.isTypeReferenceNode(type)) {
    const args = type.typeArguments ?? [];
    if (ts.isIdentifier(type.typeName)) {
      const name = type.typeName.text;
      const substituted = bound.get(name);
      if (substituted && args.length === 0) return substituted;
      // `Exclude<A, B>`, `Extract<A, B>`, `NonNullable<A>` are written in the order of `A`.
      if (FILTERING_UTILITIES.has(name) && args[0]) {
        return writtenLiterals(context, args[0], seen, bound);
      }
    }
    const declaration = declarationOfName(context, type.typeName);
    if (!declaration || !ts.isTypeAliasDeclaration(declaration)) return [];
    // A generic alias is read through its own body, with each type parameter standing for the
    // literals of the argument written for it.
    const inner = new Map<string, string[]>();
    (declaration.typeParameters ?? []).forEach((parameter, index) => {
      const argument = args[index];
      inner.set(
        parameter.name.text,
        argument ? writtenLiterals(context, argument, seen, bound) : [],
      );
    });
    return writtenLiterals(context, declaration.type, seen, inner);
  }
  if (ts.isTypeOperatorNode(type) && type.operator === ts.SyntaxKind.KeyOfKeyword) {
    const target = unparenthesized(type.type);
    if (!ts.isTypeQueryNode(target)) return [];
    const declaration = declarationOfName(context, target.exprName);
    return declaration && ts.isVariableDeclaration(declaration)
      ? constantEntries(declaration.initializer, "keys")
      : [];
  }
  if (ts.isIndexedAccessTypeNode(type)) {
    const target = unparenthesized(type.objectType);
    if (!ts.isTypeQueryNode(target)) return [];
    const declaration = declarationOfName(context, target.exprName);
    if (!declaration || !ts.isVariableDeclaration(declaration)) return [];
    const index = unparenthesized(type.indexType);
    if (index.kind === ts.SyntaxKind.NumberKeyword) {
      return constantEntries(declaration.initializer, "elements");
    }
    if (ts.isTypeOperatorNode(index) && index.operator === ts.SyntaxKind.KeyOfKeyword) {
      return constantEntries(declaration.initializer, "values");
    }
  }
  return [];
}

/** Whether a type node is a union, a union alias, or a type built from one (not a bare keyword or object type). */
const mayNameLiterals = (node: ts.TypeNode): boolean => {
  const type = unparenthesized(node);
  return (
    ts.isUnionTypeNode(type) ||
    ts.isTypeReferenceNode(type) ||
    ts.isIndexedAccessTypeNode(type) ||
    ts.isTypeOperatorNode(type)
  );
};

/**
 * The string-literal members of a union type written or derived in the source, in written order;
 * empty when the type is not a union of string literals. The checker confirms the set: it
 * contributes values the written order cannot show (derived types) and drops values a type
 * excludes. Syntactic members come first, in source order.
 */
function stringLiteralTypes(context: SourceContext, node: ts.TypeNode): string[] {
  if (!mayNameLiterals(node)) return [];
  const written = writtenLiterals(context, node);
  // A union made only of string literals needs no checker, which keeps the common case fast.
  const union = unparenthesized(node);
  if (
    ts.isUnionTypeNode(union) &&
    union.types.every((member) => {
      const inner = unparenthesized(member);
      return ts.isLiteralTypeNode(inner) || inner.kind === ts.SyntaxKind.UndefinedKeyword;
    })
  ) {
    return [...new Set(written)];
  }
  const checker = checkerOf(context);
  const resolved: string[] = [];
  const collect = (type: ts.Type) => {
    if (type.isUnion()) type.types.forEach(collect);
    else if (type.isStringLiteral()) resolved.push(type.value);
  };
  collect(checker.getTypeFromTypeNode(node));
  const known = new Set(resolved);
  return [
    ...new Set(written.filter((value) => known.has(value))),
    ...resolved.filter((value) => !written.includes(value)),
  ];
}

/** A prop's type without `undefined` and `null`, which an optional prop adds. */
function withoutNullish(node: ts.TypeNode): ts.TypeNode {
  const type = unparenthesized(node);
  if (!ts.isUnionTypeNode(type)) return type;
  const kept = type.types.filter((member) => {
    const inner = unparenthesized(member);
    return (
      inner.kind !== ts.SyntaxKind.UndefinedKeyword &&
      !(ts.isLiteralTypeNode(inner) && inner.literal.kind === ts.SyntaxKind.NullKeyword)
    );
  });
  return kept.length === 1 ? kept[0] : type;
}

/**
 * Extract string-literal union types → candidate variant axes, full (uncurated)
 * union. A local type alias that is a union of string literals comes first, in the order the
 * aliases are declared; then a prop of the component's own props type whose type names such a
 * union without a local alias (an imported union, or one built from an `as const` array).
 */
function extractVariantAxes(
  context: SourceContext,
  componentName: string,
): Array<{ prop: string; values: string[] }> {
  const sf = context.file;
  const propsBodies = propsBodiesOf(sf, componentName);
  const axes: Array<{ prop: string; values: string[] }> = [];
  const seen = new Set<string>();
  for (const statement of sf.statements) {
    if (!ts.isTypeAliasDeclaration(statement)) continue;
    const literals = stringLiteralTypes(context, statement.type);
    if (literals.length < 2) continue;
    for (const prop of axisPropsOf(statement.name.text, propsBodies)) {
      if (seen.has(prop)) continue;
      seen.add(prop);
      axes.push({ prop, values: literals });
    }
  }
  for (const members of propsBodies ?? []) {
    for (const member of members) {
      if (!ts.isPropertySignature(member) || !member.type) continue;
      const prop = propertyNameText(member.name);
      if (prop === undefined || !VARIANT_PROP_HINTS.has(prop) || seen.has(prop)) continue;
      const literals = stringLiteralTypes(context, withoutNullish(member.type));
      if (literals.length < 2) continue;
      seen.add(prop);
      axes.push({ prop, values: literals });
    }
  }
  return axes;
}

/**
 * Extract unique `data-ui` part names (the compound sub-component list): the JSX
 * attribute `data-ui="..."` and the object-literal property `"data-ui": "..."`
 * a `useRender` root passes through `mergeProps` (e.g. Alert).
 */
function extractParts(source: string): string[] {
  const parts: string[] = [];
  const seen = new Set<string>();
  for (const m of source.matchAll(/data-ui["']?\s*[=:]\s*["']([^"']+)["']/g)) {
    const name = m[1];
    if (seen.has(name)) continue;
    seen.add(name);
    parts.push(name);
  }
  return parts;
}

/** Reduces parsed CSS rules to the selector, declaration and media data the registry stores. */
function toCssRules(rules: CssRule[]): ComponentRegistryEntry["cssRules"] {
  return rules.map((r) => ({
    selectors: r.selectors,
    declarations: r.declarations.map((d) => ({ property: d.property, value: d.value })),
    media: r.media,
  }));
}

export interface ExtractComponentRegistryInput {
  name: string;
  tsxSource: string;
  cssSource: string;
  /**
   * Absolute path of the component file. Relative imports (a union type declared in a sibling
   * file) resolve from it. Without it, only types the source declares itself are read.
   */
  sourcePath?: string;
  /** Repo-relative paths, surfaced for provenance. */
  componentPath: string;
  stylesheetPath: string;
  /**
   * The primary `data-ui` value carrying this component's variant/mode/size/state
   * styling. Simple components: the same `data-ui` the root element declares
   * (e.g. "button"). Compound components: the sub-part that owns the styling
   * being resolved (e.g. "select-trigger" for Select).
   */
  rootPart: string;
  axisOverrides?: Record<
    string,
    { attribute?: string; valueSelectors?: Record<string, string | null> }
  >;
}

/** PURE. Derive a `ComponentRegistryEntry` from a component's source + stylesheet. */
export function extractComponentRegistry(
  input: ExtractComponentRegistryInput,
): ComponentRegistryEntry {
  const context = parseSource(input.tsxSource, input.sourcePath);
  const sourceFile = context.file;
  const rawAxes = extractVariantAxes(context, input.name);
  const overrides = input.axisOverrides ?? {};

  const axes: ComponentRegistryAxis[] = rawAxes.map((a) => {
    const override = overrides[a.prop];
    const stated = reactDefault(sourceFile, a.prop, a.values, input.name);
    if (stated === undefined) {
      throw refusal(
        "axis-default-missing",
        `${input.name} axis "${a.prop}" has no default: declare \`${a.prop} = "<value>"\` in ${input.name}'s parameters (one of ${a.values.join(", ")}).`,
        input.name,
      );
    }
    return {
      prop: a.prop,
      values: a.values,
      default: stated,
      attribute: override?.attribute ?? `data-${a.prop}`,
      ...(override?.valueSelectors ? { valueSelectors: override.valueSelectors } : {}),
    };
  });

  // Any axis that ONLY appears via overrides (a synthetic axis with no local
  // union type in source, e.g. Select's `state`) is appended explicitly by the
  // caller via `additionalAxes` below rather than invented here — this module
  // stays a pure derivation of what source actually declares.

  return {
    schemaVersion: COMPONENT_REGISTRY_SCHEMA_VERSION,
    name: input.name,
    source: { component: input.componentPath, stylesheet: input.stylesheetPath },
    rootPart: input.rootPart,
    parts: extractParts(input.tsxSource),
    axes,
    cssRules: toCssRules(parseComponentCss(input.cssSource)),
  };
}

/**
 * Append a synthetic axis that has no local union type in source (e.g. Select's
 * enumerated `state`, which Base UI expresses via distinct boolean attributes —
 * `data-popup-open` / `data-disabled` — never a literal `data-state` value).
 * A hand-declared enumeration that still resolves through the CSS resolver via
 * `valueSelectors`, rather than being a hand-authored binding.
 */
export function withSyntheticAxis(
  entry: ComponentRegistryEntry,
  axis: ComponentRegistryAxis,
): ComponentRegistryEntry {
  return { ...entry, axes: [...entry.axes, axis] };
}
