/**
 * Generates the rows of every `<AutoTypeTable>` on the docs pages and writes them to
 * `.generated/prop-tables.json`, which the Markdown form reads. The Markdown routes are dynamic, and
 * the generator needs the TypeScript native server, the source files and a tsconfig, which a
 * serverless request may not have. Generating at build time keeps those routes a plain file read.
 *
 * Runs under Node (the TypeScript native server cannot be spawned from Bun):
 *   node --experimental-strip-types scripts/generate-prop-tables.mts
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { autoTypeTableTags } from "../lib/auto-type-table-tags.ts";
import { typeTableGenerator } from "../lib/type-table-generator.ts";

const contentDir = path.join(process.cwd(), "content", "docs");
const out = path.join(process.cwd(), ".generated", "prop-tables.json");

function mdxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? mdxFiles(path.join(dir, entry.name))
      : entry.name.endsWith(".mdx")
        ? [path.join(dir, entry.name)]
        : [],
  );
}

const tables: Record<string, unknown> = {};
for (const file of mdxFiles(contentDir)) {
  const text = readFileSync(file, "utf8");
  for (const props of autoTypeTableTags(text)) {
    const key = JSON.stringify([props.path, props.name, props.type]);
    if (key in tables) continue;
    tables[key] = await typeTableGenerator.generateTypeTable(props);
  }
}

mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(tables)}\n`);
console.log(
  `Wrote ${Object.keys(tables).length} prop tables to ${path.relative(process.cwd(), out)}`,
);
process.exit(0);
