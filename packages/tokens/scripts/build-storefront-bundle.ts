import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type Declaration = { name: string; value: string };
type Rule = { selector: string; declarations: Declaration[] };
const STOREFRONT_SHARED_SEMANTIC_PREFIXES = ["--spacing-"] as const;
const references = (value: string) =>
  [...value.matchAll(/var\(\s*(--[\w-]+)/g)].map((match) => match[1]);

function parse(css: string, file: string): Rule[] {
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap((match) => {
    const declarations = [...match[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(
      ([, name, value]) => ({ name, value: value.trim() }),
    );
    return declarations.length ? [{ selector: match[1].trim(), declarations }] : [];
  });
  if (!rules.length) throw new Error(`Could not parse CSS declarations from ${file}`);
  return rules;
}

export function buildStorefrontBundle(sourceDir: string): string {
  const sourcePaths = [
    "foundation/default.css",
    "brand/fabre-designsystem.css",
    "brand/brand2.css",
    "theme/light.css",
    "theme/dark.css",
    "semantic-web/default.css",
    "semantic-storefront/default.css",
  ];
  const sources = sourcePaths.map((relativePath) => {
    const file = path.join(sourceDir, relativePath);
    const css = readFileSync(file, "utf8");
    if (css.includes("@layer") || css.includes("@theme"))
      throw new Error(`Invalid Storefront source: ${file}`);
    return { path: relativePath, rules: parse(css, file) };
  });
  const storefront = sources.filter((source) => source.path === "semantic-storefront/default.css");
  const selected = new Set<Declaration>(
    storefront.flatMap((source) => source.rules.flatMap((rule) => rule.declarations)),
  );
  const needed = new Set(
    storefront.flatMap((source) =>
      source.rules.flatMap((rule) => rule.declarations.flatMap(({ value }) => references(value))),
    ),
  );
  const semanticWeb = sources.find((source) => source.path === "semantic-web/default.css");
  if (!semanticWeb) throw new Error("Missing semantic-web bundle source");
  for (const rule of semanticWeb.rules)
    for (const declaration of rule.declarations) {
      if (
        !STOREFRONT_SHARED_SEMANTIC_PREFIXES.some((prefix) => declaration.name.startsWith(prefix))
      )
        continue;
      selected.add(declaration);
      for (const reference of references(declaration.value)) needed.add(reference);
    }
  for (let changed = true; changed; ) {
    changed = false;
    for (const source of sources)
      for (const rule of source.rules)
        for (const declaration of rule.declarations) {
          if (!needed.has(declaration.name) || selected.has(declaration)) continue;
          selected.add(declaration);
          for (const reference of references(declaration.value)) needed.add(reference);
          changed = true;
        }
  }
  const declared = new Set([...selected].map((declaration) => declaration.name));
  const unresolved = [...needed].filter((name) => !declared.has(name)).sort();
  if (unresolved.length)
    throw new Error(`Unresolved Storefront CSS variables: ${unresolved.join(", ")}`);
  const parts = sources.flatMap((source) => {
    const rules = source.rules.flatMap((rule) => {
      const declarations = rule.declarations.filter((declaration) => selected.has(declaration));
      if (!declarations.length) return [];
      const selector =
        (source.path === "brand/fabre-designsystem.css" &&
          rule.selector === '[data-brand="fabre-designsystem"]') ||
        (source.path === "theme/light.css" && rule.selector === '[data-theme="light"]')
          ? `:root,\n${rule.selector}`
          : rule.selector;
      return [
        `${selector} {\n${declarations.map(({ name, value }) => `  ${name}: ${value};`).join("\n")}\n}`,
      ];
    });
    return rules.length ? [`/* source: ${source.path} */\n${rules.join("\n\n")}`] : [];
  });
  return `/*! Generated from the css-storefront export preset. Do not edit. */\n${parts.join("\n\n")}\n`;
}

const [source, destination] = process.argv.slice(2);
if (source && destination) {
  mkdirSync(path.dirname(destination), { recursive: true });
  writeFileSync(destination, buildStorefrontBundle(source));
}
