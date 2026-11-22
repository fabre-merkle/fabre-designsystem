#!/usr/bin/env node
/**
 * normalize-storefront-css.mjs — strip the Studio export's cascade-layer
 * wrapper from the isolated `semantic-storefront` file so it matches what
 * `@focus/tokens-storefront-bridge` ships and the Storefront Next app expects:
 * a bare `:root { … }` block (as in the shipped
 * `css/semantic-storefront/default.css`).
 *
 * The `css` export's split layout already isolates the storefront set into its
 * own file (`css/semantic-storefront/default.css`) — that part is already
 * handled. What that file contains is `@layer <prefix>-base { :root {
 * … } }` (from `makeCssExportConfig`'s `layers.enabled`), and the Storefront
 * bridge wants the bare `:root { … }` with no layer, so it composes into
 * whatever cascade the consuming Next app already has. This script unwraps it.
 *
 * Idempotent: a file that's already unwrapped (starts with `:root {`) is left
 * untouched.
 *
 * Usage: node scripts/normalize-storefront-css.mjs <css-file>
 *   e.g. node scripts/normalize-storefront-css.mjs ./css/semantic-storefront/default.css
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const input = resolve(process.argv[2] ?? "css/semantic-storefront/default.css");
const css = readFileSync(input, "utf8");

if (/^:root\s*\{/.test(css.trimStart())) {
  console.log(`✓ ${input}: already unwrapped`);
  process.exit(0);
}

// Matches "@layer <anything>-base { <body> }" — the layer name depends on the
// project's derived prefix (packages/tokens's package.json name), not a fixed
// string.
const match = css.match(/^@layer [\w-]+-base \{\r?\n([\s\S]*)\r?\n\}\r?\n?$/);
if (!match) {
  throw new Error(`Expected ${input} to contain exactly one @layer <prefix>-base wrapper`);
}

const lines = match[1].split(/\r?\n/);
if (lines.some((line) => line.length > 0 && !line.startsWith("  "))) {
  throw new Error(`Cannot safely unwrap ${input}: unexpected indentation`);
}

const unwrapped = lines.map((line) => line.slice(2)).join("\n");
if (!unwrapped.startsWith(":root {\n") || !unwrapped.endsWith("\n}")) {
  throw new Error(`Cannot safely unwrap ${input}: expected a single :root block`);
}

writeFileSync(input, `${unwrapped}\n`);
console.log(`✓ ${input}: removed export layer wrapper`);
