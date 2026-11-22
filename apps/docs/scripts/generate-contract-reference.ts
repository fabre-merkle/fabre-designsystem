/**
 * Renders this project's own contract references as documentation pages, straight from
 * `packages/contracts`:
 *
 *   - the schema reference, from `figma-contract.schema.json`, so a field you add or change in the
 *     schema shows up here;
 *   - the command reference, from `src/project-compiler/commands.ts`, the module `--help` is built from;
 *   - the code reference (every refusal and warning code), from `src/generation-contract/diagnostics.ts`;
 *   - the catalogue reference (the component catalogue and its guidance file), from the schemas in
 *     `src/generation-contract/catalogue.ts`.
 *
 * It writes plain MDX tables under `content/docs/figma/contracts/`, so the pages take part in search, the
 * table of contents and Markdown output like any other page. The dev and build scripts run it first,
 * which is how a deviation in your copy of the schema reaches the docs.
 * If `scripts/contract-reference-pages.json` exists, its array selects which references to generate.
 * Without it, all references are generated.
 *
 *   bun scripts/generate-contract-reference.ts            write the pages
 *   bun scripts/generate-contract-reference.ts --check    exit 1 when a page is out of date
 *   bun scripts/generate-contract-reference.ts --contracts <dir>   read another packages/contracts
 */
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export interface ReferenceTable {
  columns: string[];
  rows: string[][];
}

/** A code span whose fence is longer than any backtick run in `value`, so the value survives intact. */
const code = (value: string) => {
  const longest = Math.max(0, ...(value.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(longest + 1);
  const pad = longest > 0 || value.startsWith("`") || value.endsWith("`") ? " " : "";
  return `${fence}${pad}${value}${pad}${fence}`;
};

// ---------------------------------------------------------------------------
// Markdown rendering
// ---------------------------------------------------------------------------

/** Text outside backticks must not be read as MDX: braces open expressions and `<` opens tags. */
function escapeMdx(text: string): string {
  // A code span opens and closes with the same number of backticks.
  return text
    .split(/((`+)[\s\S]*?\2)/g)
    .filter((part, index) => index % 3 !== 2)
    .map((part) =>
      part.startsWith("`")
        ? part
        : part
            .replace(/\\/g, "\\\\")
            .replace(/\{/g, "\\{")
            .replace(/\}/g, "\\}")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;"),
    )
    .join("");
}

function cell(value: string): string {
  // Pipes inside backticks still end a table cell in Markdown, so they are escaped everywhere.
  return escapeMdx(value.replace(/\s*\n\s*/g, " ").trim()).replace(/\|/g, "\\|");
}

export function tableMarkdown(table: ReferenceTable): string {
  const head = `| ${table.columns.join(" | ")} |\n| ${table.columns.map(() => "---").join(" | ")} |`;
  const rows = table.rows.map((row) => `| ${row.map(cell).join(" | ")} |`);
  return `${head}\n${rows.join("\n")}\n`;
}

const section = (title: string, body: string) => `\n## ${title}\n\n${body}\n`;

// ---------------------------------------------------------------------------
// What the contracts package defines
// ---------------------------------------------------------------------------

interface Diagnostics {
  diagnosticReference(): Array<{
    code: string;
    severity: string;
    exit?: number;
    message: string;
    remedy: string;
  }>;
}

interface Catalogue {
  componentCatalogueJsonSchema(): JsonSchema;
  componentGuidanceJsonSchema(): JsonSchema;
}

interface Commands {
  PROGRAM_NAME: string;
  EXIT_CODES: ReadonlyArray<{ code: number; meaning: string }>;
  COMMANDS: ReadonlyArray<{
    name: string;
    summary: string;
    arguments: Array<{ name: string; required: boolean }>;
    options: Array<{ flags: string; description: string }>;
  }>;
  allExamples(): Array<{ command: string; description: string; exit: number }>;
}

function diagnosticsTable(diagnostics: Diagnostics): ReferenceTable {
  return {
    columns: ["Code", "Severity", "Exit", "Meaning", "Remedy"],
    rows: diagnostics
      .diagnosticReference()
      .map((item) => [
        code(item.code),
        item.severity,
        item.exit === undefined ? "-" : String(item.exit),
        item.message,
        item.remedy,
      ]),
  };
}

function commandsTable(commands: Commands): ReferenceTable {
  return {
    columns: ["Command", "Arguments", "Flags", "What it does"],
    rows: commands.COMMANDS.map((command) => [
      code(`${commands.PROGRAM_NAME} ${command.name}`),
      command.arguments.length === 0
        ? "-"
        : command.arguments
            .map((arg) => code(arg.required ? `<${arg.name}>` : `[${arg.name}]`))
            .join(" "),
      command.options.length === 0 ? "-" : command.options.map((o) => code(o.flags)).join(" "),
      command.summary,
    ]),
  };
}

/** Each flag once, with the commands that take it. */
function flagsTable(commands: Commands): ReferenceTable {
  const flags = new Map<string, { description: string; commands: string[] }>();
  for (const command of commands.COMMANDS) {
    for (const option of command.options) {
      const entry = flags.get(option.flags) ?? { description: option.description, commands: [] };
      entry.commands.push(command.name);
      flags.set(option.flags, entry);
    }
  }
  return {
    columns: ["Flag", "Commands", "Meaning"],
    rows: [...flags].map(([flag, entry]) => [
      code(flag),
      entry.commands.map(code).join(" "),
      entry.description,
    ]),
  };
}

function exitCodesTable(commands: Commands): ReferenceTable {
  return {
    columns: ["Exit code", "Meaning"],
    rows: commands.EXIT_CODES.map((item) => [code(String(item.code)), item.meaning]),
  };
}

function examplesTable(commands: Commands): ReferenceTable {
  return {
    columns: ["Command", "What it shows", "Exit"],
    rows: commands
      .allExamples()
      .map((example) => [
        code(`${commands.PROGRAM_NAME} ${example.command}`),
        example.description,
        String(example.exit),
      ]),
  };
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

type JsonSchema = {
  type?: string | string[];
  description?: string;
  title?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  anyOf?: JsonSchema[];
  enum?: unknown[];
  const?: unknown;
  additionalProperties?: JsonSchema | boolean;
  $ref?: string;
  $defs?: Record<string, JsonSchema>;
};

interface SchemaSection {
  title: string;
  description: string;
  table: ReferenceTable;
}

const refName = (ref: string) => ref.replace("#/$defs/", "");

/** A short type label: `string`, `"a" | "b"`, `string[]`, a named definition. */
function typeLabel(node: JsonSchema): string {
  if (node.$ref) return refName(node.$ref);
  if (node.const !== undefined) return JSON.stringify(node.const);
  if (node.enum) return node.enum.map((value) => JSON.stringify(value)).join(" | ");
  if (node.anyOf) return [...new Set(node.anyOf.map(typeLabel))].join(" | ");
  if (node.type === "array") {
    const item = node.items ? typeLabel(node.items) : "unknown";
    return item.includes(" | ") ? `(${item})[]` : `${item}[]`;
  }
  if (node.type === "object") {
    if (node.properties) return "object";
    const extra = node.additionalProperties;
    return typeof extra === "object" ? `Record<string, ${typeLabel(extra)}>` : "object";
  }
  return Array.isArray(node.type) ? node.type.join(" | ") : (node.type ?? "unknown");
}

/** The object nodes one level below `node`: an array's items, a record's values, a union's members. */
function childObjects(node: JsonSchema): Array<{ suffix: string; node: JsonSchema }> {
  if (node.type === "array" && node.items) {
    return childObjects(node.items).map((child) => ({
      suffix: `[]${child.suffix}`,
      node: child.node,
    }));
  }
  if (node.anyOf) return node.anyOf.flatMap(childObjects);
  // An object without listed fields is still a branch: it accepts `{}`, so no field is required by it.
  if (
    node.properties ||
    (node.type === "object" && typeof node.additionalProperties !== "object")
  ) {
    return [{ suffix: "", node }];
  }
  if (typeof node.additionalProperties === "object") {
    return childObjects(node.additionalProperties).map((child) => ({
      suffix: `[key]${child.suffix}`,
      node: child.node,
    }));
  }
  return [];
}

/**
 * Object branches at the same path (the members of a union) are merged: a field named by several
 * branches becomes one row whose type lists every accepted form, and it is required only when every
 * branch requires it.
 */
function mergeBranches(children: Array<{ suffix: string; node: JsonSchema }>): Array<{
  suffix: string;
  properties: Record<string, JsonSchema>;
  required: string[];
}> {
  const groups = new Map<string, JsonSchema[]>();
  for (const child of children) {
    groups.set(child.suffix, [...(groups.get(child.suffix) ?? []), child.node]);
  }
  return [...groups].map(([suffix, branches]) => {
    const byName = new Map<string, JsonSchema[]>();
    for (const branch of branches) {
      for (const [name, node] of Object.entries(branch.properties ?? {})) {
        byName.set(name, [...(byName.get(name) ?? []), node]);
      }
    }
    const properties: Record<string, JsonSchema> = {};
    for (const [name, nodes] of byName) {
      properties[name] =
        nodes.length === 1
          ? nodes[0]
          : { anyOf: nodes, description: nodes.find((node) => node.description)?.description };
    }
    const required = [...byName.keys()].filter((name) =>
      branches.every((branch) => branch.required?.includes(name)),
    );
    return { suffix, properties, required };
  });
}

function flatten(
  properties: Record<string, JsonSchema>,
  required: readonly string[],
  prefix: string,
  rows: string[][],
  seen: Set<string>,
): void {
  for (const [name, node] of Object.entries(properties)) {
    const field = `${prefix}${name}`;
    rows.push([
      code(field),
      code(typeLabel(node)),
      required.includes(name) ? "yes" : "",
      node.description ?? "",
    ]);
    for (const group of mergeBranches(childObjects(node))) {
      const key = `${field}${group.suffix}`;
      if (seen.has(key)) continue;
      seen.add(key);
      flatten(group.properties, group.required, `${key}.`, rows, seen);
    }
  }
}

function sectionTable(node: JsonSchema): ReferenceTable {
  const rows: string[][] = [];
  flatten(node.properties ?? {}, node.required ?? [], "", rows, new Set());
  return { columns: ["Field", "Type", "Required", "Description"], rows };
}

/** The contract's top-level fields, then each shared definition the fields refer to. */
function schemaSections(schema: JsonSchema): SchemaSection[] {
  const sections: SchemaSection[] = [
    {
      title: schema.title ?? "Contract",
      description: schema.description ?? "",
      table: sectionTable(schema),
    },
  ];
  for (const [name, node] of Object.entries(schema.$defs ?? {})) {
    const table = sectionTable(node);
    // A definition without fields (an enum, a primitive, a union) is described by its type alone.
    const description =
      table.rows.length > 0
        ? (node.description ?? "")
        : [node.description, `Type: ${code(typeLabel(node))}.`].filter(Boolean).join(" ");
    sections.push({ title: name, description, table });
  }
  return sections;
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

const frontmatter = (title: string, description: string) =>
  `---\ntitle: ${title}\ndescription: ${description}\n---\n`;

const NOTICE =
  "{/* Generated by scripts/generate-contract-reference.ts from packages/contracts. Change the contracts package, then run `bun run docs:contracts`. */}\n";

/** One section per object in a schema: its heading, its description and its field table. */
function sectionsMarkdown(schema: JsonSchema): string {
  return schemaSections(schema)
    .map((entry) =>
      section(
        entry.title,
        `${entry.description ? `${escapeMdx(entry.description)}\n\n` : ""}${entry.table.rows.length > 0 ? tableMarkdown(entry.table) : ""}`,
      ),
    )
    .join("");
}

function schemaPage(schema: JsonSchema, includeCodes: boolean): string {
  const sections = sectionsMarkdown(schema);
  return `${frontmatter("Contract schema reference", "Contract fields, types and requirements.")}
${NOTICE}
This page lists the fields you can write in a \`<component>.figma.contract.ts\` file. It is generated
from \`packages/contracts/figma-contract.schema.json\`, the JSON Schema that the schema in
\`packages/contracts\` produces, so it shows this project's schema, including any change you have made
to it.

Nested fields appear under their parent with a dotted path: \`[]\` marks an array item and \`[key]\`
marks a record key. The schema checks the shape of each field only. Rules that relate fields to each
other or to the component source are enforced by the compiler, so a contract can pass the schema and
still be refused.${includeCodes ? " Those refusals are listed in the [code reference](/docs/figma/contracts/codes)." : ""}
${sections}`;
}

function commandsPage(commands: Commands, includeCodes: boolean): string {
  const run = commands.PROGRAM_NAME;
  return `${frontmatter("Contract commands reference", "Compiler commands, flags and exit codes.")}
${NOTICE}
This page is generated from \`packages/contracts/src/project-compiler/commands.ts\`, the module the
\`--help\` text is built from. Run the commands with \`bun run ${run} <command>\` from the
\`packages/contracts\` directory. Every command prints each problem as a diagnostic with a stable
code${includeCodes ? ", listed in the [code reference](/docs/figma/contracts/codes)" : ""}.

${tableMarkdown(commandsTable(commands))}${section("Flags", tableMarkdown(flagsTable(commands)))}${section(
  "Exit codes",
  tableMarkdown(exitCodesTable(commands)),
)}${section("Examples", tableMarkdown(examplesTable(commands)))}`;
}

function codesPage(diagnostics: Diagnostics): string {
  return `${frontmatter("Contract code reference", "Compiler diagnostics and how to resolve them.")}
${NOTICE}
This page is generated from \`packages/contracts/src/generation-contract/diagnostics.ts\`. Every
refusal and warning the compiler reports has one of these codes. Codes are stable names that scripts
and agents can match on. Pass \`--json\` to a command to receive each diagnostic as data with its code,
severity, path, message and remedy.

An error ends the command with the exit code shown. A warning is printed and never changes the exit
code.

${tableMarkdown(diagnosticsTable(diagnostics))}`;
}

/** The page for the component catalogue and its guidance file, with each schema rendered as tables. */
function cataloguePage(catalogue: Catalogue): string {
  return `${frontmatter(
    "Component catalogue reference",
    "Component catalogue fields and regeneration.",
  )}
${NOTICE}
The compiler writes a flat summary of every contract to \`.agents/component-catalogue.json\` in the same
run that writes \`.agents/figma-generation-contract.json\`. It lists each component's axes with their
values and defaults, its slots and what fills them, its part tree and the components it composes, so an
agent can answer which components exist and what can go in each slot. Run \`bun run figma:contract\` to
regenerate it and commit the result; \`bun run figma:contract:check\` fails when it is stale. Never edit
it by hand.

Guidance does not come from the contracts. Write it in \`.agents/component-guidance.json\`, keyed by
component slug, and the compiler merges it into the catalogue. Every field is optional, and the compiler
refuses an entry or a link that names a component with no contract.

\`\`\`json
{
  "version": 1,
  "components": {
    "tooltip": {
      "when": "Short, non-essential hints.",
      "avoidWhen": "The content is interactive.",
      "alternatives": ["popover"]
    }
  }
}
\`\`\`

${sectionsMarkdown(catalogue.componentCatalogueJsonSchema())}${sectionsMarkdown(
  catalogue.componentGuidanceJsonSchema(),
)}`;
}

const REFERENCE_PAGES = ["schema", "commands", "codes", "catalogue"] as const;
type ReferencePage = (typeof REFERENCE_PAGES)[number];

/** Every generated file, by path relative to `content/docs/figma/contracts`. */
export async function renderContractReference(
  contractsRoot: string,
  selected: readonly ReferencePage[] = REFERENCE_PAGES,
): Promise<Record<string, string>> {
  const load = async <T>(file: string): Promise<T> =>
    (await import(pathToFileURL(path.join(contractsRoot, file)).href)) as T;
  const schema = JSON.parse(
    await readFile(path.join(contractsRoot, "figma-contract.schema.json"), "utf8"),
  ) as JsonSchema;
  const commands = await load<Commands>("src/project-compiler/commands.ts");
  const diagnostics = await load<Diagnostics>("src/generation-contract/diagnostics.ts");
  const catalogue = await load<Catalogue>("src/generation-contract/catalogue.ts");
  const pages = {
    schema: schemaPage(schema, selected.includes("codes")),
    commands: commandsPage(commands, selected.includes("codes")),
    codes: codesPage(diagnostics),
    catalogue: cataloguePage(catalogue),
  };
  return {
    ...Object.fromEntries(selected.map((name) => [`${name}.mdx`, pages[name]])),
    // Laid out as the project's Biome formats it, so a build does not dirty a formatted tree.
    "meta.json": `{\n  "title": "Contracts",\n  "pages": [${selected.map((name) => JSON.stringify(name)).join(", ")}]\n}\n`,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const docsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const contractsIndex = args.indexOf("--contracts");
  const contractsRoot =
    contractsIndex >= 0
      ? path.resolve(args[contractsIndex + 1] ?? "")
      : path.resolve(docsRoot, "../../packages/contracts");
  if (!existsSync(path.join(contractsRoot, "figma-contract.schema.json"))) {
    console.error(
      `No contracts package at ${contractsRoot}. Pass --contracts <dir> or install packages/contracts.`,
    );
    process.exit(3);
  }
  const outDir = path.join(docsRoot, "content", "docs", "figma", "contracts");
  const selectionPath = path.join(docsRoot, "scripts", "contract-reference-pages.json");
  let selected: readonly ReferencePage[] = REFERENCE_PAGES;
  if (existsSync(selectionPath)) {
    const value: unknown = JSON.parse(readFileSync(selectionPath, "utf8"));
    if (
      !Array.isArray(value) ||
      value.some((name) => !REFERENCE_PAGES.some((page) => page === name)) ||
      new Set(value).size !== value.length
    ) {
      throw new Error(`Invalid contract reference page selection in ${selectionPath}`);
    }
    selected = REFERENCE_PAGES.filter((name) => value.includes(name));
  }
  const files = await renderContractReference(contractsRoot, selected);
  const excluded = REFERENCE_PAGES.filter((name) => !selected.includes(name)).map(
    (name) => `${name}.mdx`,
  );

  if (args.includes("--check")) {
    const stale = Object.entries(files)
      .filter(([name, text]) => {
        const target = path.join(outDir, name);
        return !existsSync(target) || readFileSync(target, "utf8") !== text;
      })
      .map(([name]) => name);
    stale.push(...excluded.filter((name) => existsSync(path.join(outDir, name))));
    if (stale.length > 0) {
      console.error(
        `Out of date: ${stale.join(", ")}. Run \`bun run docs:contracts\` and commit the pages.`,
      );
      process.exit(1);
    }
    return;
  }

  await mkdir(outDir, { recursive: true });
  for (const name of excluded) await rm(path.join(outDir, name), { force: true });
  for (const [name, text] of Object.entries(files)) {
    await writeFile(path.join(outDir, name), text);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
