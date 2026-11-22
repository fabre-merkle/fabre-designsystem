import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import postcss from "postcss";
import { cssTokenName } from "../components/docs/token-name";
import type { DocumentationBrand, DocumentationToken } from "./design-tokens";

type Mode = "light" | "dark";
type Bridge = { kind: "fumadocs" | "storefront"; css: string };

function matchesSelector(selector: string, context: Record<string, string>): boolean {
  return selector.split(",").some((part) => {
    const trimmed = part.trim();
    if (trimmed === ":root") return true;
    const attribute = /\[data-([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+)))?\]/g;
    const matches = [...trimmed.matchAll(attribute)];
    if (!matches.length || trimmed.replace(attribute, "").trim()) return false;
    return matches.every((match) => {
      const actual = context[match[1]];
      const expected = match[2] ?? match[3] ?? match[4];
      return actual !== undefined && (expected === undefined || actual === expected);
    });
  });
}

function cssDeclarations(
  css: string,
  context: Record<string, string>,
  values: Map<string, string>,
) {
  const root = postcss.parse(css);
  root.walkRules((rule) => {
    for (let parent = rule.parent; parent && parent.type !== "root"; parent = parent.parent) {
      if (parent.type === "atrule" && parent.name !== "layer") return;
    }
    if (!matchesSelector(rule.selector, context)) return;
    rule.walkDecls(/^--/, (decl) => {
      values.set(decl.prop, decl.value);
    });
  });
}

function cyclicCustomProperties(values: Map<string, string>): Set<string> {
  // CSS invalidates every property in a dependency cycle, even if a member has a fallback.
  const dependencies = new Map(
    [...values].map(([name, value]) => [
      name,
      [...value.matchAll(/var\(\s*(--[\w-]+)/g)]
        .map((match) => match[1])
        .filter((dependency) => values.has(dependency)),
    ]),
  );
  const indices = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const cyclic = new Set<string>();
  let nextIndex = 0;
  const visit = (name: string) => {
    indices.set(name, nextIndex);
    lowLinks.set(name, nextIndex++);
    stack.push(name);
    onStack.add(name);
    for (const dependency of dependencies.get(name) ?? []) {
      if (!indices.has(dependency)) {
        visit(dependency);
        lowLinks.set(name, Math.min(lowLinks.get(name)!, lowLinks.get(dependency)!));
      } else if (onStack.has(dependency)) {
        lowLinks.set(name, Math.min(lowLinks.get(name)!, indices.get(dependency)!));
      }
    }
    if (lowLinks.get(name) !== indices.get(name)) return;
    const component: string[] = [];
    let member: string;
    do {
      member = stack.pop()!;
      onStack.delete(member);
      component.push(member);
    } while (member !== name);
    if (component.length > 1 || dependencies.get(name)?.includes(name)) {
      for (const entry of component) cyclic.add(entry);
    }
  };
  for (const name of values.keys()) if (!indices.has(name)) visit(name);
  return cyclic;
}

function resolveValue(
  value: string,
  values: Map<string, string>,
  cyclic: Set<string>,
  seen: Set<string>,
): string | undefined {
  let output = "";
  let start = 0;
  for (;;) {
    const next = value.indexOf("var(", start);
    if (next === -1) return output + value.slice(start);
    output += value.slice(start, next);
    let depth = 1;
    let end = next + 4;
    let comma = -1;
    for (; end < value.length && depth; end++) {
      if (value[end] === "(") depth++;
      else if (value[end] === ")") depth--;
      else if (value[end] === "," && depth === 1 && comma === -1) comma = end;
    }
    if (depth) return undefined;
    const name = value.slice(next + 4, comma === -1 ? end - 1 : comma).trim();
    if (!/^--[\w-]+$/.test(name)) return undefined;
    const raw = values.get(name);
    const resolved =
      raw !== undefined && !cyclic.has(name) && !seen.has(name)
        ? resolveValue(raw, values, cyclic, new Set([...seen, name]))
        : undefined;
    const fallback =
      comma === -1
        ? undefined
        : resolveValue(value.slice(comma + 1, end - 1).trim(), values, cyclic, seen);
    if (resolved === undefined && fallback === undefined) return undefined;
    output += resolved ?? fallback;
    start = end;
  }
}

/** Resolve the installed export's custom properties for a named documentation context. */
export function tokenCssValues(
  root: string,
  brand: DocumentationBrand,
  mode: Mode,
  brandStylesheets: string[],
  bridges: Bridge[],
  rows: DocumentationToken[],
  componentStylesheets: string[] = [],
): Record<string, string> {
  if (!brand.cssAvailable) return {};
  const context = {
    foundation: "default",
    brand: brand.cssBrand,
    theme: mode,
    web: "lg",
    "semantic-web": "default",
    "semantic-fumadocs": "default",
    "semantic-storefront": "default",
  };
  const cssRoot = resolve(root, "../css");
  const read = (file: string) => {
    const path = resolve(cssRoot, file);
    return existsSync(path) ? readFileSync(path, "utf8") : "";
  };
  const stylesheets = [
    read("foundation/default.css"),
    read("semantic-web/default.css"),
    ...brandStylesheets,
    read(`theme/${mode}.css`),
    read("web/lg.css"),
    ...bridges.map((bridge) => bridge.css),
    ...componentStylesheets,
  ];
  const values = new Map<string, string>();
  for (const css of stylesheets) if (css) cssDeclarations(css, context, values);
  const cyclic = cyclicCustomProperties(values);
  const result: Record<string, string> = {};
  for (const row of rows) {
    const variable = cssTokenName(row.name);
    const names =
      row.type === "typography"
        ? ["font-family", "font-size", "font-weight", "line-height", "letter-spacing"].map(
            (part) => `${variable}-${part}`,
          )
        : [variable];
    const resolved = names.map((name) => {
      const value = values.get(name);
      return value === undefined || cyclic.has(name)
        ? undefined
        : resolveValue(value, values, cyclic, new Set([name]));
    });
    if (resolved.every((value) => value !== undefined)) result[row.name] = resolved.join(" · ");
  }
  return result;
}
