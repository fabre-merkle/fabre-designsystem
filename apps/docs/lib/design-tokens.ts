import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export type TokenCategory =
  | "colour"
  | "typography"
  | "spacing-sizing"
  | "radius"
  | "elevation"
  | "motion"
  | "opacity"
  | "backdrop"
  | "component";

export type DocumentationToken = {
  name: string;
  type: string;
  description: string;
  aliases: string[];
  authoredValue: string;
};

export type DocumentationTokenGroup = {
  label: string;
  semantic: boolean;
  cssAvailable: boolean;
  rows: DocumentationToken[];
};

export type DocumentationBrand = {
  label: string;
  tokenSet: string;
  cssBrand: string;
  cssAvailable: boolean;
};

type Theme = {
  group: string;
  name: string;
  selectedTokenSets: Record<string, string>;
};

export type TokenData = {
  root: string;
  themes: Theme[];
  brands: DocumentationBrand[];
  brandStylesheets: string[];
  bridges: { kind: "fumadocs" | "storefront"; css: string }[];
  readSet?: (set: string) => unknown;
  componentCss?: Record<string, string>;
};

export type TokenReferenceData =
  | { available: false; reason: string }
  | {
      available: true;
      brands: (DocumentationBrand & { groups: DocumentationTokenGroup[] })[];
      brandStylesheets: string[];
      componentStylesheets: string[];
      bridges: { kind: "fumadocs" | "storefront"; css: string }[];
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Could not read design-token data at ${path}.`, { cause: error });
  }
}

function docsDirectory(): string {
  const cwd = process.cwd();
  return existsSync(join(cwd, "content/docs")) ? cwd : resolve(cwd, "apps/docs");
}

/** Read the project metadata; a missing raw export is reported, not replaced with sample values. */
export function readTokenData(): TokenData | { reason: string } {
  const docs = docsDirectory();
  const root = resolve(docs, "../../packages/tokens/dtcg");
  const themesFile = join(root, "$themes.json");
  if (!existsSync(themesFile)) {
    return {
      reason:
        "Raw design-token data is not installed. Add the project's DTCG data to packages/tokens/dtcg and rebuild the documentation.",
    };
  }
  const rawThemes = readJson(themesFile);
  if (
    !Array.isArray(rawThemes) ||
    !rawThemes.every(
      (theme) =>
        isRecord(theme) &&
        typeof theme.group === "string" &&
        typeof theme.name === "string" &&
        isRecord(theme.selectedTokenSets) &&
        Object.values(theme.selectedTokenSets).every((state) => typeof state === "string"),
    )
  ) {
    throw new Error(`Invalid theme metadata in ${themesFile}.`);
  }
  const themes: Theme[] = rawThemes.map((theme) => ({
    group: theme.group,
    name: theme.name,
    selectedTokenSets: theme.selectedTokenSets,
  }));
  const brandThemes = themes.filter((theme) => theme.group === "brand");
  if (!brandThemes.length) throw new Error(`No brand theme is defined in ${themesFile}.`);
  if (brandThemes.some((theme) => !/^[\w-]+$/.test(theme.name))) {
    throw new Error(`Invalid brand theme name in ${themesFile}.`);
  }

  const contextFile = join(docs, "lib/token-context.json");
  let brands: DocumentationBrand[];
  if (existsSync(contextFile)) {
    const context = readJson(contextFile);
    if (
      !isRecord(context) ||
      context.version !== 1 ||
      !Array.isArray(context.brands) ||
      !context.brands.length ||
      !context.brands.every(
        (brand) =>
          isRecord(brand) &&
          typeof brand.label === "string" &&
          typeof brand.tokenSet === "string" &&
          typeof brand.cssBrand === "string" &&
          /^[\w-]+$/.test(brand.tokenSet) &&
          /^[\w-]+$/.test(brand.cssBrand) &&
          brandThemes.some((theme) => theme.name === brand.tokenSet),
      )
    ) {
      throw new Error(`Invalid or outdated brand configuration in ${contextFile}.`);
    }
    brands = context.brands.map((brand) => ({
      label: brand.label,
      tokenSet: brand.tokenSet,
      cssBrand: brand.cssBrand,
      cssAvailable: false,
    }));
  } else {
    // A direct registry install has no scaffold choices: document only the first theme.
    brands = [
      {
        label: brandThemes[0].name,
        tokenSet: brandThemes[0].name,
        cssBrand: "default",
        cssAvailable: false,
      },
    ];
  }
  const stylesheets = new Map<string, string>();
  const brandCss = (name: string, selectorName: string) => {
    const file = resolve(root, "../css/brand", `${name}.css`);
    if (!existsSync(file)) return undefined;
    const css = readFileSync(file, "utf8");
    const selector = new RegExp(
      `\\[data-brand\\s*=\\s*(?:"${selectorName}"|'${selectorName}'|${selectorName})\\s*\\]`,
    );
    return selector.test(css) ? { file, css } : undefined;
  };
  const primary = brands[0];
  const primaryExported = Boolean(brandCss(primary.tokenSet, primary.tokenSet));
  brands = brands.map((brand, index) => {
    const primaryPlaceholder =
      index > 0 &&
      brand.tokenSet === primary.cssBrand &&
      primary.tokenSet !== primary.cssBrand &&
      !primaryExported;
    const exported = primaryPlaceholder ? undefined : brandCss(brand.tokenSet, brand.tokenSet);
    const fallback =
      brandCss(brand.cssBrand, brand.cssBrand) ??
      brandCss(index === 0 ? "default" : "brand2", brand.cssBrand);
    const selected = exported ?? fallback;
    if (!selected) return brand;
    stylesheets.set(selected.file, selected.css);
    return {
      ...brand,
      cssBrand: exported ? brand.tokenSet : brand.cssBrand,
      cssAvailable: true,
    };
  });
  const bridges: TokenData["bridges"] = [];
  for (const [kind, group, file, selector] of [
    ["fumadocs", "semantic-fumadocs", "theme.css", /@theme\s*\{/g],
    ["storefront", "semantic-storefront", "default.css", /:root\s*\{/g],
  ] as const) {
    const active = themes.some(
      (theme) =>
        theme.group === group &&
        Object.values(theme.selectedTokenSets).some((state) => state === "enabled"),
    );
    if (!active) continue;
    const cssFile = resolve(root, "../css", group, file);
    if (!existsSync(cssFile)) continue;
    const css = readFileSync(cssFile, "utf8");
    if (!selector.test(css)) throw new Error(`Unexpected ${group} CSS in ${cssFile}.`);
    selector.lastIndex = 0;
    bridges.push({ kind, css: css.replace(selector, `[data-semantic-${kind}="default"] {`) });
  }
  return { root, themes, brands, brandStylesheets: [...stylesheets.values()], bridges };
}

function aliasesOf(value: unknown): string[] {
  const source = typeof value === "string" ? value : JSON.stringify(value);
  if (!source) return [];
  return [...new Set([...source.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1]))];
}

function flattenTokens(
  value: unknown,
  path: string[] = [],
  inheritedType = "",
): DocumentationToken[] {
  if (!isRecord(value)) return [];
  const type = typeof value.$type === "string" ? value.$type : inheritedType;
  const rows: DocumentationToken[] = [];
  if ("$value" in value && path.length) {
    rows.push({
      name: path.join("."),
      type,
      description:
        typeof value.$description === "string" ? value.$description : "No usage guidance recorded.",
      aliases: aliasesOf(value.$value),
      authoredValue: typeof value.$value === "string" ? value.$value : JSON.stringify(value.$value),
    });
  }
  for (const [key, child] of Object.entries(value)) {
    if (!key.startsWith("$")) rows.push(...flattenTokens(child, [...path, key], type));
  }
  return rows;
}

function tokensFromSet(data: TokenData, set: string): DocumentationToken[] {
  if (!/^[\w/-]+$/.test(set) || set.split("/").includes("..")) {
    throw new Error(`Invalid token-set path: ${set}`);
  }
  if (data.readSet) return flattenTokens(data.readSet(set));
  const file = join(data.root, `${set}.json`);
  if (!existsSync(file)) throw new Error(`The selected token set is missing: ${file}`);
  return flattenTokens(readJson(file));
}

type GroupDefinition = {
  label: string;
  source: "brand" | "semantic" | "theme" | "foundation" | "web" | "fumadocs" | "storefront";
  file: string;
  include?: (token: DocumentationToken) => boolean;
};

const GROUPS: Record<Exclude<TokenCategory, "component">, GroupDefinition[]> = {
  colour: [
    { label: "Foundation colour primitives", source: "foundation", file: "default" },
    { label: "Brand colours", source: "brand", file: "color" },
    {
      label: "Theme colour ramps",
      source: "theme",
      file: "light",
      include: (token) => token.name.startsWith("theme.color."),
    },
    {
      label: "Semantic colours",
      source: "semantic",
      file: "color",
      include: (token) => !token.name.startsWith("color.surface."),
    },
    { label: "Documentation colours", source: "fumadocs", file: "default" },
    { label: "Storefront colours", source: "storefront", file: "color" },
    { label: "Storefront agentic colours", source: "storefront", file: "agentic" },
  ],
  typography: [
    { label: "Brand typography", source: "brand", file: "typography" },
    {
      label: "Responsive typography",
      source: "web",
      file: "*",
      include: (token) => token.type === "fontSize",
    },
    { label: "Semantic typography", source: "semantic", file: "typography" },
    { label: "Storefront typography", source: "storefront", file: "typography" },
  ],
  "spacing-sizing": [
    { label: "Brand dimensions", source: "brand", file: "dimension" },
    {
      label: "Responsive dimensions",
      source: "web",
      file: "*",
      include: (token) => token.type === "dimension",
    },
    { label: "Semantic spacing and sizing", source: "semantic", file: "spacing" },
    { label: "Storefront dimensions", source: "storefront", file: "dimension" },
  ],
  radius: [
    { label: "Brand radius and stroke", source: "brand", file: "border" },
    { label: "Semantic radius and stroke", source: "semantic", file: "border" },
    { label: "Storefront borders", source: "storefront", file: "border" },
  ],
  elevation: [
    { label: "Brand shadows", source: "brand", file: "elevation" },
    {
      label: "Theme surfaces and shadows",
      source: "theme",
      file: "light",
      include: (token) =>
        token.name.startsWith("theme.surface.") || token.name.startsWith("theme.shadow."),
    },
    {
      label: "Semantic surfaces",
      source: "semantic",
      file: "color",
      include: (token) => token.name.startsWith("color.surface."),
    },
    {
      label: "Semantic shadows and stacking",
      source: "semantic",
      file: "elevation",
      include: (token) => !token.name.startsWith("backdrop."),
    },
    { label: "Storefront shadows", source: "storefront", file: "elevation" },
  ],
  motion: [
    { label: "Brand durations and easing", source: "brand", file: "motion" },
    { label: "Semantic transitions", source: "semantic", file: "motion" },
  ],
  opacity: [
    { label: "Brand opacity", source: "brand", file: "opacity" },
    { label: "Semantic opacity", source: "semantic", file: "opacity" },
    { label: "Storefront opacity", source: "storefront", file: "custom" },
  ],
  backdrop: [
    { label: "Brand blur", source: "brand", file: "blur" },
    { label: "Brand saturation", source: "brand", file: "saturate" },
    {
      label: "Semantic backdrop",
      source: "semantic",
      file: "elevation",
      include: (token) => token.name.startsWith("backdrop."),
    },
  ],
};

/** Build the reference from selected sets, keeping every token's owning tier visible. */
export function tokenReferenceData(
  category: TokenCategory,
  data: TokenData | { reason: string } = readTokenData(),
): TokenReferenceData {
  if ("reason" in data) return { available: false, reason: data.reason };
  const componentSets =
    category === "component"
      ? data.themes
          .filter((theme) => theme.group === "component")
          .flatMap((theme) =>
            Object.entries(theme.selectedTokenSets)
              .filter(([name, state]) => name.startsWith("component/") && state === "enabled")
              .map(([set]) => ({
                set,
                theme: theme.name,
                cssFile: resolve(data.root, "../css/component", `${theme.name}.css`),
              })),
          )
      : [];
  const componentGroups = componentSets.flatMap(({ set, theme, cssFile }) => {
    const rows = tokensFromSet(data, set);
    if (!rows.length) return [];
    return [
      {
        label: `Component tokens: ${set.slice("component/".length)}`,
        semantic: true,
        cssAvailable: data.componentCss ? Boolean(data.componentCss[theme]) : existsSync(cssFile),
        rows,
      },
    ];
  });
  const componentStylesheets = data.componentCss
    ? [...new Set(Object.values(data.componentCss))]
    : [...new Set(componentSets.map(({ cssFile }) => cssFile))].flatMap((file) =>
        existsSync(file) ? [readFileSync(file, "utf8")] : [],
      );
  const semanticTheme = data.themes.find((theme) => theme.group === "semantic-web");
  const themeTheme =
    data.themes.find((theme) => theme.group === "theme" && theme.name === "light") ??
    data.themes.find((theme) => theme.group === "theme");
  const webTheme =
    data.themes.find((theme) => theme.group === "web" && theme.name === "lg") ??
    data.themes.find((theme) => theme.group === "web");
  return {
    available: true,
    brandStylesheets: data.brandStylesheets,
    componentStylesheets: category === "component" ? componentStylesheets : [],
    bridges: data.bridges,
    brands: data.brands.map((brand) => {
      const brandTheme = data.themes.find(
        (theme) => theme.group === "brand" && theme.name === brand.tokenSet,
      );
      if (!brandTheme) throw new Error(`The configured brand ${brand.tokenSet} is missing.`);
      const groups =
        category === "component"
          ? componentGroups
          : GROUPS[category].flatMap((definition) => {
              const theme =
                definition.source === "brand"
                  ? brandTheme
                  : definition.source === "semantic"
                    ? semanticTheme
                    : definition.source === "theme"
                      ? themeTheme
                      : definition.source === "web"
                        ? webTheme
                        : data.themes.find(
                            (entry) =>
                              entry.group ===
                              (definition.source === "fumadocs"
                                ? "semantic-fumadocs"
                                : definition.source === "storefront"
                                  ? "semantic-storefront"
                                  : "foundation"),
                          );
              const prefix =
                definition.source === "brand"
                  ? `brand/${brand.tokenSet}/`
                  : definition.source === "semantic"
                    ? "semantic-web/"
                    : definition.source === "theme"
                      ? "theme/"
                      : definition.source === "web"
                        ? "web/"
                        : definition.source === "fumadocs"
                          ? "semantic-fumadocs/"
                          : definition.source === "storefront"
                            ? "semantic-storefront/"
                            : "foundation/";
              const set = Object.entries(theme?.selectedTokenSets ?? {}).find(
                ([name, state]) =>
                  name.startsWith(prefix) &&
                  (definition.file === "*" || name.slice(prefix.length) === definition.file) &&
                  state === "enabled",
              )?.[0];
              if (!set) return [];
              const rows = tokensFromSet(data, set).filter(definition.include ?? (() => true));
              return rows.length
                ? [
                    {
                      label: definition.label,
                      semantic: ["semantic", "fumadocs", "storefront"].includes(definition.source),
                      cssAvailable:
                        definition.source !== "fumadocs" && definition.source !== "storefront"
                          ? true
                          : data.bridges.some((bridge) => bridge.kind === definition.source),
                      rows,
                    },
                  ]
                : [];
            });
      return { ...brand, groups };
    }),
  };
}
