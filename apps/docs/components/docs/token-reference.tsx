import { asMarkdown, md } from "fumadocs-core/server";
import type { ReactNode } from "react";
import { readTokenData, type TokenCategory, tokenReferenceData } from "../../lib/design-tokens";
import { tokenCssValues } from "../../lib/resolve-token-css";
import { tokenGroupId } from "./token-name";
import { TokenTable } from "./token-table";

type TokenReferenceProps = {
  category: TokenCategory;
  selection?: readonly { name: string; description: string }[];
  children?: ReactNode;
};

function referenceData(category: TokenCategory, selection?: TokenReferenceProps["selection"]) {
  const data = tokenReferenceData(category);
  if (!data.available || !selection) return data;
  const descriptions = new Map(selection.map(({ name, description }) => [name, description]));
  for (const brand of data.brands) {
    const available = new Set(brand.groups.flatMap((group) => group.rows.map((row) => row.name)));
    const missing = selection.filter(({ name }) => !available.has(name)).map(({ name }) => name);
    if (missing.length) {
      throw new Error(
        `Unknown ${category} quick-reference tokens for ${brand.label}: ${missing.join(", ")}. Regenerate DESIGN.md from the current project tokens.`,
      );
    }
  }
  return {
    ...data,
    brands: data.brands.map((brand) => ({
      ...brand,
      groups: brand.groups
        .map((group) => ({
          ...group,
          rows: group.rows
            .filter((row) => descriptions.has(row.name))
            .map((row) => ({
              ...row,
              description:
                row.description === "No usage guidance recorded."
                  ? descriptions.get(row.name) || row.description
                  : row.description,
            })),
        }))
        .filter((group) => group.rows.length),
    })),
  };
}

export function TokenReference({ category, selection, children }: TokenReferenceProps) {
  const data = referenceData(category, selection);
  if (!data.available) return <p>{data.reason}</p>;
  if (category === "component" && !data.brands.some((brand) => brand.groups.length)) {
    return (
      <p>No component token sets are enabled. The naming examples below are illustrative only.</p>
    );
  }
  const { brandStylesheets, componentStylesheets, bridges, ...tableData } = data;
  const missing = data.brands.filter((brand) => !brand.cssAvailable);
  const missingGroups = [
    ...new Set(
      data.brands.flatMap((brand) =>
        brand.groups.filter((group) => !group.cssAvailable).map((group) => group.label),
      ),
    ),
  ];
  return (
    <div className="docs-token-reference-host">
      {missing.length ? (
        <p role="status">{`Resolved brand CSS is unavailable for ${missing.map((brand) => brand.label).join(", ")}. Generate or restore the project's brand CSS and rebuild the documentation.`}</p>
      ) : null}
      {missingGroups.length ? (
        <p role="status">{`Resolved CSS is unavailable for ${missingGroups.join(", ")}. Generate or restore the corresponding token CSS and rebuild the documentation.`}</p>
      ) : null}
      {brandStylesheets.map((css, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: Server-rendered stylesheets retain canonical cascade order.
        <style key={index}>{`@scope (.docs-token-reference-host) {\n${css}\n}`}</style>
      ))}
      {componentStylesheets.map((css, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: The selected component sets retain canonical theme order.
        <style key={index}>{`@scope (.docs-token-reference-host) {\n${css}\n}`}</style>
      ))}
      {bridges.map(({ kind, css }) => (
        <style key={kind}>{`@scope (.docs-token-reference-host) {\n${css}\n}`}</style>
      ))}
      <TokenTable
        category={category}
        data={tableData}
        compareModes={category === "colour" || category === "elevation"}
      >
        {children}
      </TokenTable>
    </div>
  );
}

/** JSX references render their headings at runtime, outside MDX's static heading extraction. */
export function tokenReferenceToc(markdown: string) {
  const category = /<TokenReference\s+category=["']([^"']+)["']/.exec(markdown)?.[1];
  if (!category) return [];
  const categories: TokenCategory[] = [
    "colour",
    "typography",
    "spacing-sizing",
    "radius",
    "elevation",
    "motion",
    "opacity",
    "backdrop",
    "component",
  ];
  const selected = categories.find((value) => value === category);
  if (!selected) throw new Error(`Unknown token reference category: ${category}`);
  const data = tokenReferenceData(selected);
  if (!data.available) return [];
  const labels = [
    ...new Set(data.brands.flatMap((brand) => brand.groups.map((group) => group.label))),
  ];
  return labels.map((title) => ({ title, url: `#${tokenGroupId(selected, title)}`, depth: 2 }));
}

function cell(value: string): string {
  return value
    .replace(/\|/g, "\\|")
    .replace(/\s*\n\s*/g, " ")
    .trim();
}

export async function TokenReferenceMarkdown({
  category,
  selection,
  children,
}: TokenReferenceProps) {
  asMarkdown();
  const data = referenceData(category, selection);
  if (!data.available) return `\n${data.reason}\n\n`;
  if (category === "component" && !data.brands.some((brand) => brand.groups.length)) {
    return "\nNo component token sets are enabled. The naming examples below are illustrative only.\n\n";
  }
  const source = readTokenData();
  if ("reason" in source) return `\n${source.reason}\n\n`;
  const introduction = children ? await md`${children}` : "";
  const compareModes = category === "colour" || category === "elevation";
  const references = data.brands
    .map((brand) => {
      const rows = brand.groups.flatMap((group) => group.rows);
      const light = tokenCssValues(
        source.root,
        brand,
        "light",
        data.brandStylesheets,
        data.bridges,
        rows,
        data.componentStylesheets,
      );
      const dark = compareModes
        ? tokenCssValues(source.root, brand, "dark", data.brandStylesheets, data.bridges, rows)
        : {};
      const groups = brand.groups.map((group) => {
        const tokenRows = group.rows.map((row) => {
          const value = (values: Record<string, string>) =>
            group.cssAvailable ? cell(values[row.name] ?? "Not available") : "Not available";
          return `| \`${cell(row.name)}\` | ${group.semantic ? `${cell(row.aliases.join(", "))} | ` : ""}${value(light)} | ${compareModes ? `${value(dark)} | ` : ""}${cell(row.description)} |`;
        });
        return `\n### ${group.label}\n\n| Token | ${group.semantic ? "Alias | " : ""}${compareModes ? "Light value | Dark value" : "Value"} | Use |\n| --- | ${group.semantic ? "--- | " : ""}${compareModes ? "--- | ---" : "---"} | --- |\n${tokenRows.join("\n")}\n`;
      });
      return `\n${data.brands.length > 1 ? `## ${brand.label}\n` : ""}${groups.join("\n")}`;
    })
    .join("\n");
  const context = compareModes
    ? "Values use the large web context."
    : "Values use the light theme and large web context.";
  return `${introduction}\n${context}\n${references}`;
}
