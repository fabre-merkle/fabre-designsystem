import { asMarkdown } from "fumadocs-core/server";
import { readTokenData } from "../../lib/design-tokens";
import { TokenConfigurationTable, tokenConfigurationData } from "./token-configuration-table";

export function TokenConfiguration() {
  return <TokenConfigurationTable data={tokenConfigurationData(readTokenData())} />;
}

export function TokenConfigurationMarkdown() {
  asMarkdown();
  const data = tokenConfigurationData(readTokenData());
  if ("reason" in data) return `\n${data.reason}\n\n`;
  const cell = (value: string) => value.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");
  const rows = data.rows.map(
    (row) => `| \`${cell(row.dimension)}\` | ${cell(row.choices)} | ${cell(row.purpose)} |`,
  );
  return `\n| Dimension or set | Choices | Purpose |\n| --- | --- | --- |\n${rows.join("\n")}\n\n`;
}
