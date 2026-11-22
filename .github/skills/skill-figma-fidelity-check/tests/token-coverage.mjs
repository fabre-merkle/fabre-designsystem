#!/usr/bin/env node
/**
 * Code→Figma token-coverage gate (the `skill-figma-fidelity-check` coverage assertion, runnable in CI).
 *
 * For every `var(--token)` in the component CSS, assert a Figma variable resolves by separator-stripped
 * name match (handles the camelCase boundary: `--color-primary-on-brand` ↔ `color/primary/onBrand`).
 * Reports per-component matched / drift; excludes computed/runtime + animation vars (not bindable).
 * Exits non-zero on drift — wire into CI to catch stale/renamed token refs before they ship.
 *
 * Usage:
 *   node token-coverage.mjs --components <packages/ui/src/components> --variables <figma-variables.json> [--only button,input,...]
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, basename, dirname } from "node:path";

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf("--" + k); return i >= 0 ? argv[i + 1] : d; };
const componentsDir = arg("components");
const variablesFile = arg("variables");
const only = (arg("only", "") || "").split(",").map((s) => s.trim()).filter(Boolean);
if (!componentsDir || !variablesFile) { console.error("need --components and --variables"); process.exit(2); }

const norm = (s) => s.replace(/[-/_]/g, "").toLowerCase();
const figma = JSON.parse(readFileSync(variablesFile, "utf8")).names;
const figmaSet = new Set(figma.map(norm));

// Not bindable in Figma → excluded from drift: computed/runtime layout vars + animation timing.
// `surface-level-*` are the shared level-paint locals Elevated's stylesheet derives at runtime.
const NA = /^(active-tab|switch-block-size|switch-inline-size|switch-padding|.*-panel-height|anchor-width|available-height|transform-origin|brand-duration|brand-easing|transition-|surface-level-)/;
// Shadows are EFFECT STYLES, not variables — Tokens Studio doesn't export them as Figma variables.
// They're applied as DROP_SHADOW effects (or generated effect styles), so they're not token "drift".
const EFFECT = /^shadow-/;

const cssFiles = (dir) => readdirSync(dir).flatMap((e) => {
  const p = join(dir, e);
  return statSync(p).isDirectory() ? cssFiles(p) : e.endsWith(".css") ? [p] : [];
});

// Group CSS files by component dir first, so a component with multiple CSS files is aggregated (not overwritten).
const filesByComponent = {};
for (const f of cssFiles(componentsDir)) {
  const comp = basename(dirname(f));
  if (only.length && !only.includes(comp)) continue;
  (filesByComponent[comp] ??= []).push(f);
}

const byComponent = {}; const allDrift = new Set(); const allTokens = new Set();
for (const [comp, files] of Object.entries(filesByComponent)) {
  const used = new Set();
  // Component-local custom properties (`--ctl-height: var(--control-height-md)`) are aliases the
  // stylesheet defines for itself — the tokens they alias are checked, the alias is not a variable.
  const local = new Set();
  for (const f of files) {
    const css = readFileSync(f, "utf8");
    for (const m of css.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)/g)) used.add(m[1].slice(2));
    for (const m of css.matchAll(/(?:^|[;{\s])--([a-zA-Z0-9-]+)\s*:/g)) local.add(m[1]);
  }
  const matched = [], drift = [], na = [], effect = [];
  for (const t of used) {
    allTokens.add(t);
    if (NA.test(t) || local.has(t)) { na.push(t); continue; }
    if (EFFECT.test(t)) { effect.push(t); continue; }
    if (figmaSet.has(norm(t))) matched.push(t);
    else { drift.push(t); allDrift.add(t); }
  }
  byComponent[comp] = { cssFiles: files.length, used: used.size, matched: matched.length, drift: drift.sort(), effectStyles: effect.sort(), na: na.length };
}

const summary = {
  components: Object.keys(byComponent).length,
  distinctTokensUsed: allTokens.size,
  driftCount: allDrift.size,
  driftTokens: [...allDrift].sort(),
};
console.log(JSON.stringify({ summary, byComponent }, null, 2));
process.exit(allDrift.size > 0 ? 1 : 0);
