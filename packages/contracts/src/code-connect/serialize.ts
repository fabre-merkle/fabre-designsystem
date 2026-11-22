import type { CodeConnectMapping, PropMapping, ShownIn } from "./types";

const RESERVED = new Set([
  "arguments",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "eval",
  "export",
  "extends",
  "false",
  "figma",
  "finally",
  "for",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instance",
  "instanceof",
  "interface",
  "let",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

/**
 * The header line every generated template carries. It marks a file as owned by the generator, so
 * cleanup removes only files that have it and leaves hand-written templates alone.
 */
export const GENERATED_MARKER =
  "// Generated from the project's Figma contract and manifest; regenerate, do not edit by hand.";

/** Throw when a prop name cannot be a JavaScript local in the emitted template. */
function assertIdentifier(name: string): void {
  if (!/^[A-Za-z_$][\w$]*$/.test(name) || RESERVED.has(name)) {
    throw new Error(`Code Connect prop "${name}" is not a usable identifier in a template.`);
  }
}

/** Every template local a mapping declares, so a collision is refused instead of emitted. */
function declaredLocals(p: PropMapping): string[] {
  if (p.kind === "swap") return [p.local, `${p.local}Instance`];
  if (p.kind === "slot" || p.kind === "text" || p.kind === "boolean" || p.kind === "presence") {
    return [p.local];
  }
  if (p.kind === "enum" && p.folds) return [p.prop, `${p.prop}Base`];
  return [p.prop];
}

/** The Figma axes any fold reads, with every value of each, so each is read once with `getEnum`. */
function foldedAxes(props: PropMapping[]): Map<string, string[]> {
  const axes = new Map<string, string[]>();
  for (const p of props) {
    if (p.kind !== "enum" && p.kind !== "presence" && p.kind !== "text" && p.kind !== "swap") {
      continue;
    }
    const reads = p.kind === "text" || p.kind === "swap" ? p.shown?.reads : p.reads;
    for (const [axis, values] of Object.entries(reads ?? {})) axes.set(axis, values);
  }
  return axes;
}

/** Throw when two declarations would use the same local, which makes the template invalid. */
function assertUniqueLocals(props: PropMapping[]): void {
  const seen = new Set<string>();
  const names = [
    ...props.flatMap(declaredLocals),
    ...[...foldedAxes(props).keys()].map((a) => `${a}Value`),
  ];
  for (const name of names) {
    if (seen.has(name)) {
      throw new Error(`Code Connect local "${name}" is declared by more than one mapping.`);
    }
    seen.add(name);
  }
}

/** Throw when a fixed prop (a split axis value) could not be written as a plain JSX attribute. */
function assertFixedProp(prop: string, value: string | boolean): void {
  if (!/^[A-Za-z_$][\w$]*$/.test(prop)) {
    throw new Error(`Code Connect fixed prop "${prop}" is not a usable attribute name.`);
  }
  if (typeof value === "string") assertFixedValue(prop, value);
}

function assertFixedValue(label: string, value: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(value)) {
    throw new Error(
      `Code Connect value "${value.replace(/[\r\n\u2028\u2029]/gu, " ")}" for "${label}" must be a plain token without quotes or spaces.`,
    );
  }
}

/** Throw when a value written into a `//` header or a string literal could escape it. */
function assertSingleLine(label: string, value: string | undefined): void {
  if (value !== undefined && /[\r\n\u2028\u2029]/u.test(value)) {
    throw new Error(`Code Connect ${label} must not contain line terminators.`);
  }
}

/** Throw when the component name cannot be a JSX element tag and an import binding. */
function assertComponentName(name: string): void {
  if (!/^[A-Z][A-Za-z0-9_$]*$/.test(name) || RESERVED.has(name)) {
    throw new Error(
      `Code Connect component name "${name.replace(/[\r\n\u2028\u2029]/gu, " ")}" must be a PascalCase identifier.`,
    );
  }
}

/** Throw unless the render tag is the component itself or one of its members (`Field.Root`). */
function assertRenderTag(tag: string, name: string): void {
  if (tag !== name && !new RegExp(`^${name}(\\.[A-Z][A-Za-z0-9_$]*)+$`).test(tag)) {
    throw new Error(
      `Code Connect render tag "${tag.replace(/[\r\n\u2028\u2029]/gu, " ")}" must be "${name}" or one of its members.`,
    );
  }
}

/** Throw when the import specifier could break out of the quoted `imports` entry. */
function assertImportPath(value: string): void {
  if (value === "" || /['"`\\\r\n\u2028\u2029]/u.test(value)) {
    throw new Error(
      "Code Connect import path must be a plain specifier without quotes or newlines.",
    );
  }
}

/** An object literal of string entries, one per line, indented by `pad`. */
function literal(values: Record<string, string | boolean>, pad = ""): string {
  const entries = Object.entries(values)
    .map(([k, v]) => `${pad}  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
    .join("\n");
  return `{\n${entries}\n${pad}}`;
}

/** The expression that turns a base value into its folded code value. */
function foldExpression(p: Extract<PropMapping, { kind: "enum" }>): string {
  let expression = `${p.prop}Base`;
  for (const fold of [...(p.folds ?? [])].reverse()) {
    const condition = Object.entries(fold.when)
      .map(([axis, value]) => `${axis}Value === ${JSON.stringify(value)}`)
      .join(" && ");
    const map = `{ ${Object.entries(fold.values)
      .map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`)
      .join(", ")} }`;
    expression = `${condition}\n    ? (${map}[${p.prop}Base] ?? ${p.prop}Base)\n    : ${expression}`;
  }
  return expression;
}

/** `axisValue === "a" || …` for each axis, joined with `&&`: the cells a `when`/`unless` names. */
function cellCondition(match: Record<string, string[]>): string {
  return Object.entries(match)
    .map(([axis, values]) => {
      const any = values.map((v) => `${axis}Value === ${JSON.stringify(v)}`).join(" || ");
      return values.length > 1 ? `(${any})` : any;
    })
    .join(" && ");
}

/** The condition under which a text or icon is rendered: its part's cells, then its content gate. */
function presentCondition(p: { gate?: string; shown?: ShownIn }): string {
  return [
    p.shown?.when ? cellCondition(p.shown.when) : "",
    p.shown?.unless ? `!(${cellCondition(p.shown.unless)})` : "",
    p.gate ?? "",
  ]
    .filter(Boolean)
    .join(" && ");
}

/** Statements that read one Figma property from `instance`, per Figma's template property API. */
function serializeProp(p: PropMapping): string {
  if (p.kind === "enum") {
    const read = `instance.getEnum(${JSON.stringify(p.figmaProp)}, ${literal(p.values)})`;
    if (!p.folds) return `const ${p.prop} = ${read}`;
    return `const ${p.prop}Base = ${read}\n\nconst ${p.prop} =\n  ${foldExpression(p)}`;
  }
  if (p.kind === "axisProp") {
    return `const ${p.prop} = instance.getEnum(${JSON.stringify(p.figmaProp)}, ${literal(p.values)})`;
  }
  if (p.kind === "presence") {
    const read = `instance.getBoolean(${JSON.stringify(p.figmaProp)})`;
    // The content is always shown in the cells `unless` names, so the property alone must not hide it.
    const always = Object.entries(p.unless ?? {})
      .map(([axis, values]) => {
        const any = values.map((v) => `${axis}Value === ${JSON.stringify(v)}`).join(" || ");
        return values.length > 1 ? `(${any})` : any;
      })
      .join(" && ");
    return `const ${p.local} = ${always ? `${read} || (${always})` : read}`;
  }
  if (p.kind === "boolean") {
    return `const ${p.local} = instance.getBoolean(${JSON.stringify(p.figmaProp)})`;
  }
  if (p.kind === "text") {
    const read = `instance.getString(${JSON.stringify(p.figmaProp)})`;
    const present = presentCondition(p);
    return `const ${p.local} = ${present ? `${present} ? ${read} : ""` : read}`;
  }
  if (p.kind === "swap") {
    // The swapped icon is its own component: its Code Connect template renders it, and an icon
    // with none renders nothing rather than a guess.
    const where = presentCondition(p);
    const present = `${where ? `${where} && ` : ""}${p.local}Instance?.hasCodeConnect()`;
    return `const ${p.local}Instance = instance.getInstanceSwap(${JSON.stringify(p.figmaProp)})\n\nconst ${p.local} = ${present}\n  ? ${p.local}Instance.executeTemplate().example\n  : ""`;
  }
  return `const ${p.local} = instance.getSlot(${JSON.stringify(p.figmaProp)})`;
}

/** A mapping whose content composes into a code prop: a slot, text or a swapped icon. */
type ContentMapping =
  | Extract<PropMapping, { kind: "slot" }>
  | Extract<PropMapping, { kind: "swap" }>
  | (Extract<PropMapping, { kind: "text" }> & { asString?: false });

function isContent(p: PropMapping): p is ContentMapping {
  return p.kind === "slot" || p.kind === "swap" || (p.kind === "text" && !p.asString);
}

/** The JSX attribute a non-content prop contributes to the example, or none. */
function attribute(p: Exclude<PropMapping, ContentMapping>): string {
  if (p.kind === "presence") return "";
  if (p.kind === "boolean") return `\${${p.local} ? "${p.prop}" : "${p.prop}={false}"}`;
  if (p.kind === "text") return `\${${p.local} ? figma.code\`${p.prop}="\${${p.local}}"\` : ""}`;
  if (p.kind === "enum") return `${p.prop}="\${${p.prop}}"`;
  const booleans = Object.values(p.values).every((v) => typeof v === "boolean");
  return booleans
    ? `\${${p.prop} === undefined ? "" : ${p.prop} ? "${p.prop}" : "${p.prop}={false}"}`
    : `\${${p.prop} === undefined ? "" : \`${p.prop}="\${${p.prop}}"\`}`;
}

type SlotMapping = ContentMapping;

/** Kebab-case a component name for the template's unique `id`. */
function templateId(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .toLowerCase();
}

/**
 * Render a derived mapping to a parserless Code Connect template (`.figma.ts`): the `// url=`
 * header block, `figma.selectedInstance`, property reads, and a default export with `example`
 * (`figma.code`), `imports`, `id` and `metadata`. Contract properties with no code counterpart
 * are listed in the header, not guessed. The output is a pure function of the mapping.
 */
export function serializeMapping(m: CodeConnectMapping): string {
  for (const p of m.props) for (const name of declaredLocals(p)) assertIdentifier(name);
  for (const axis of foldedAxes(m.props).keys()) assertIdentifier(`${axis}Value`);
  assertUniqueLocals(m.props);
  for (const f of m.fixed ?? []) assertFixedProp(f.prop, f.value);
  if (m.idSuffix !== undefined) assertFixedValue("id suffix", m.idSuffix);
  assertSingleLine("url", m.figmaUrl);
  assertSingleLine("source", m.source);
  const importName = m.importName ?? m.componentName;
  assertComponentName(m.componentName);
  assertComponentName(importName);
  assertRenderTag(m.renderTag, importName);
  for (const u of m.unmapped) assertSingleLine("property name", u.name);
  assertImportPath(m.importPath);

  const header = [
    `// url=${m.figmaUrl}`,
    ...(m.source ? [`// source=${m.source}`] : []),
    `// component=${m.componentName}`,
    GENERATED_MARKER,
    ...m.unmapped.map((u) => `// Not mapped: ${u.kind} "${u.name}" (${u.reason}).`),
  ].join("\n");

  // A fold reads another axis's Figma value. It is a VARIANT property, so it is read with `getEnum`
  // and an identity map over the axis values, as the template API documents for variants.
  const foldReads = [...foldedAxes(m.props)].map(
    ([axis, values]) =>
      `const ${axis}Value = instance.getEnum(${JSON.stringify(axis)}, ${literal(
        Object.fromEntries(values.map((v) => [v, v])),
      )})`,
  );
  const reads = [...foldReads, ...m.props.map(serializeProp)].join("\n\n");

  // Slots compose their code prop in anatomy order: `children` renders between the tags, any other
  // prop becomes one attribute that holds them all.
  const slots = m.props.filter(isContent);
  const groups = new Map<string, SlotMapping[]>();
  for (const slot of slots) groups.set(slot.prop, [...(groups.get(slot.prop) ?? []), slot]);
  const children = groups.get("children");
  const attrs = [
    ...(m.fixed ?? []).map((f) =>
      typeof f.value === "boolean"
        ? f.value
          ? f.prop
          : `${f.prop}={false}`
        : `${f.prop}="${f.value}"`,
    ),
    ...m.props
      .filter((p): p is Exclude<PropMapping, ContentMapping> => !isContent(p))
      .map(attribute)
      .filter((a) => a !== ""),
    ...[...groups]
      .filter(([prop]) => prop !== "children")
      .map(([prop, group]) => {
        const items = group.map((slot) => `\${${slot.local}}`).join("");
        const any = group.map((slot) => slot.local).join(" || ");
        return `\${${any} ? figma.code\`${prop}={${items}}\` : ""}`;
      }),
  ].map((a) => `      ${a}`);
  const open = attrs.length > 0 ? `<${m.renderTag}\n${attrs.join("\n")}\n    ` : `<${m.renderTag}`;
  const element = children
    ? `${open}>${children.map((slot) => `\${${slot.local}}`).join("")}</${m.renderTag}>`
    : `${open}${attrs.length > 0 ? "" : " "}/>`;
  const body = reads ? `${reads}\n\n` : "";

  return `${header}
import figma from "figma"
const instance = figma.selectedInstance

${body}export default {
  example: figma.code\`
    ${element}
  \`,
  imports: ['import { ${importName} } from "${m.importPath}"'],
  id: ${JSON.stringify(m.idSuffix ? `${templateId(m.componentName)}-${templateId(m.idSuffix)}` : templateId(m.componentName))},
  metadata: { nestable: true },
}
`;
}
