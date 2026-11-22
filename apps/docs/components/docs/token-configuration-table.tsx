import type { TokenData } from "../../lib/design-tokens";

export type TokenConfigurationData =
  | { reason: string }
  | { rows: { dimension: string; choices: string; purpose: string }[] };

export function tokenConfigurationData(
  data: Pick<TokenData, "themes" | "brands"> | { reason: string },
): TokenConfigurationData {
  if ("reason" in data) return data;
  const purposes: Record<string, string> = {
    foundation: "Shared scales and calculation inputs.",
    brand: "Configured identity values.",
    theme: "Mode-aware values.",
    web: "Responsive context values.",
    "semantic-web": "Interface roles.",
    "semantic-fumadocs": "Documentation-specific roles.",
    "semantic-storefront": "Storefront-specific roles.",
  };
  const groups = [...new Set(data.themes.map((theme) => theme.group))].filter(
    (group) => group !== "component",
  );
  const componentSets = [
    ...new Set(
      data.themes
        .filter((theme) => theme.group === "component")
        .flatMap((theme) =>
          Object.entries(theme.selectedTokenSets)
            .filter(([name, state]) => name.startsWith("component/") && state === "enabled")
            .map(([name]) => name.slice("component/".length)),
        ),
    ),
  ];
  const rows = groups.flatMap((group) => {
    const themes = data.themes.filter(
      (theme) =>
        theme.group === group &&
        Object.values(theme.selectedTokenSets).some((state) => state === "enabled"),
    );
    if (!themes.length) return [];
    const choices =
      group === "brand"
        ? data.brands.map((brand) => brand.label)
        : themes.map((theme) => theme.name);
    return [
      {
        dimension: group,
        choices: choices.join(", "),
        purpose: purposes[group] ?? "Project-defined token context.",
      },
    ];
  });
  rows.push({
    dimension: "component",
    choices: componentSets.length ? componentSets.join(", ") : "No enabled component token sets",
    purpose: componentSets.length
      ? "Optional component-specific aliases from project data; selection does not establish production approval."
      : "Optional tier; naming examples are illustrative only.",
  });
  return { rows };
}

export function TokenConfigurationTable({ data }: { data: TokenConfigurationData }) {
  if ("reason" in data) return <p>{data.reason}</p>;
  return (
    <table>
      <thead>
        <tr>
          <th>Dimension or set</th>
          <th>Choices</th>
          <th>Purpose</th>
        </tr>
      </thead>
      <tbody>
        {data.rows.map((row) => (
          <tr key={row.dimension}>
            <td>
              <code>{row.dimension}</code>
            </td>
            <td>{row.choices}</td>
            <td>{row.purpose}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
