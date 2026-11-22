import { readFile } from "node:fs/promises";
import path from "node:path";
import { asMarkdown } from "fumadocs-core/server";
import type { GeneratedDoc } from "fumadocs-typescript";
import type { MDXComponents } from "mdx/types";
import { resolveTable } from "./auto-type-table-source";
import { isBaseUIEntry, typeTableGenerator } from "./type-table-generator";

/**
 * Markdown form of `<AutoTypeTable>`: the same generated rows as the page, as one table per type.
 * Registered through `markdownConfig.components` (the project-owned hook) so the shipped
 * `markdown-components.tsx` stays identical to its registry item.
 *
 * The Markdown routes are dynamic, so the rows come from `.generated/prop-tables.json`, written at
 * build time by `scripts/generate-prop-tables.mts`. A dev server always uses the live generator
 * (see `auto-type-table-source.ts`).
 */

const SNAPSHOT = path.join(process.cwd(), ".generated", "prop-tables.json");

let snapshot: Promise<Record<string, GeneratedDoc[]> | undefined> | undefined;

function readSnapshot() {
  snapshot ??= readFile(SNAPSHOT, "utf8").then(
    (text) => JSON.parse(text) as Record<string, GeneratedDoc[]>,
    () => undefined,
  );
  return snapshot;
}

function cell(value: string): string {
  return value
    .replace(/\|/g, "\\|")
    .replace(/\s*\n\s*/g, " ")
    .trim();
}

async function AutoTypeTable(props: { path?: string; name?: string; type?: string }) {
  const key = JSON.stringify([props.path, props.name, props.type]);
  const docs = await resolveTable(key, {
    production: process.env.NODE_ENV === "production",
    readSnapshot,
    live: () =>
      typeTableGenerator.generateTypeTable({
        path: props.path,
        name: props.name,
        type: props.type,
      }),
  });
  asMarkdown();
  const table = (entries: GeneratedDoc["entries"]) => {
    const rows = entries.map((entry) => {
      const fallback = entry.tags
        .find((tag) => tag.name === "default" || tag.name === "defaultValue")
        ?.text.trim();
      const flags = `${entry.required ? " (required)" : ""}${entry.deprecated ? " (deprecated)" : ""}`;
      return `| \`${entry.name}\`${flags} | \`${cell(entry.simplifiedType)}\` | ${fallback ? `\`${cell(fallback)}\`` : ""} | ${cell(entry.description)} |`;
    });
    return `\n| Prop | Type | Default | Description |\n| --- | --- | --- | --- |\n${rows.join("\n")}\n`;
  };
  // The same split as the page: main table first, then the generic Base UI props under a heading.
  return docs
    .map((doc) => {
      const main = doc.entries.filter((entry) => !isBaseUIEntry(entry));
      const generic = doc.entries.filter(isBaseUIEntry);
      return `${table(main)}${generic.length ? `\n#### Base UI props\n${table(generic)}` : ""}`;
    })
    .join("\n");
}

export const autoTypeTableMarkdownComponents: MDXComponents = { AutoTypeTable };
