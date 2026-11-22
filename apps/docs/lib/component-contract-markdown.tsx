import { asMarkdown } from "fumadocs-core/server";
import type { MDXComponents } from "mdx/types";
import { componentContractView, type ReferenceTable } from "./component-contract";

/**
 * Markdown form of `<ComponentContract>`: everything the compiler resolved, as context for agents.
 * The page shows the parts, axes and slots in a collapsed group; this form also carries the
 * documented examples and the notes on how React maps to Figma. Registered through
 * `markdownConfig.components`, the project-owned hook.
 */

function cell(value: string): string {
  return value
    .replace(/\|/g, "\\|")
    .replace(/\s*\n\s*/g, " ")
    .trim();
}

export function tableMarkdown(table: ReferenceTable): string {
  const head = `| ${table.columns.join(" | ")} |\n| ${table.columns.map(() => "---").join(" | ")} |`;
  const rows = table.rows.map((row) => `| ${row.map(cell).join(" | ")} |`);
  return `${head}\n${rows.join("\n")}\n`;
}

export function sectionMarkdown(title: string, body: string): string {
  return `\n### ${title}\n\n${body}\n`;
}

/** Parts, axes, slots, documented examples and React to Figma notes. */
async function ComponentContract({ slug, heading }: { slug: string; heading?: boolean }) {
  const view = await componentContractView(slug);
  if (!view) return undefined;
  asMarkdown();
  const parts = [
    ...(heading ? ["\n## Figma contract"] : []),
    `\nThe compiled Figma contract for ${view.name}: the parts, axes and slots the compiler resolved from the contract and the component source.\n`,
    ...view.tables.map((entry) => sectionMarkdown(entry.title, tableMarkdown(entry.table))),
  ];
  if (view.examples.length > 0) {
    parts.push(
      sectionMarkdown("Documented examples", view.examples.map((label) => `- ${label}`).join("\n")),
    );
  }
  if (view.notes.length > 0) {
    parts.push(
      sectionMarkdown("React to Figma notes", view.notes.map((note) => `- ${note}`).join("\n")),
    );
  }
  return `${parts.join("\n")}\n`;
}

export const componentContractMarkdownComponents: MDXComponents = { ComponentContract };
