#!/usr/bin/env bun
/**
 * docs:check — validates that every @/components/docs/* import used in MDX
 * pages resolves to a concrete shipped module.
 * Runs from apps/docs/ in the scaffolded project.
 *
 * Verifies:
 *   1. tsconfig.json has the @/* path alias wired ("@/*": ["./*"]).
 *   2. Every `from "@/components/docs/..."` import in content/docs/**\/*.mdx
 *      resolves to a real .tsx file on disk under components/docs/.
 *
 * This is a pre-flight check before bun run build. It does NOT typecheck
 * the modules themselves — run check-types for that.
 */
import { existsSync, readFileSync } from "node:fs";
import { glob } from "node:fs/promises";
import path from "node:path";

const TSCONFIG_PATH = "tsconfig.json";
const MDX_GLOB = "content/docs/**/*.mdx";
const IMPORT_RE = /from\s+["']@\/components\/docs\/([^"']+)["']/g;

// ── Check 1: tsconfig @/* alias ───────────────────────────────────────────────

if (!existsSync(TSCONFIG_PATH)) {
  console.error(`❌ docs:check — ${TSCONFIG_PATH} not found (run from apps/docs/)`);
  process.exit(1);
}

let tsconfig: { compilerOptions?: { paths?: Record<string, string[]> } };
try {
  tsconfig = JSON.parse(readFileSync(TSCONFIG_PATH, "utf8"));
} catch (e) {
  console.error(`❌ docs:check — failed to parse ${TSCONFIG_PATH}: ${e}`);
  process.exit(1);
}

const atAlias = tsconfig.compilerOptions?.paths?.["@/*"];
if (!atAlias || !atAlias.some((v) => v === "./*")) {
  console.error(
    `❌ docs:check — tsconfig.json is missing the @/* path alias.\n` +
      `   Add "paths": { "@/*": ["./*"] } to compilerOptions.\n` +
      `   This is seeded by @focus/docs-fumadocs-core — was it installed?`,
  );
  process.exit(1);
}

// ── Check 2: every @/components/docs/* import resolves ────────────────────────

const missing: string[] = [];
const checked = new Set<string>();

const mdxFiles: string[] = [];
for await (const f of glob(MDX_GLOB)) {
  mdxFiles.push(f);
}

if (mdxFiles.length === 0) {
  console.warn(`⚠  docs:check — no MDX files found under content/docs/ — nothing to check`);
  process.exit(0);
}

for (const mdxFile of mdxFiles) {
  const src = readFileSync(mdxFile, "utf8");
  for (const match of src.matchAll(IMPORT_RE)) {
    const importPath = match[1]; // e.g. "accordion-parts" or "demos/form-demo"
    if (checked.has(importPath)) continue;
    checked.add(importPath);

    const resolved = path.join("components", "docs", `${importPath}.tsx`);
    if (!existsSync(resolved)) {
      missing.push(`  • @/components/docs/${importPath}  →  ${resolved}  (missing)`);
    }
  }
}

if (missing.length > 0) {
  console.error(
    `❌ docs:check — ${missing.length} unresolved @/components/docs/* import${missing.length === 1 ? "" : "s"}:\n`,
  );
  for (const m of missing) console.error(m);
  console.error(
    `\n   Each MDX page that imports from @/components/docs/ must ship a concrete\n` +
      `   <name>-parts.tsx or demos/<name>-demo.tsx alongside it. See skill-contribute-docs.\n` +
      `   Run \`shadcn add @focus/docs-components\` to pull the full set, or create\n` +
      `   the missing file per the skill.`,
  );
  process.exit(1);
}

console.log(
  `✓ docs:check — ${checked.size} @/components/docs/* import${checked.size === 1 ? "" : "s"} verified across ${mdxFiles.length} MDX file${mdxFiles.length === 1 ? "" : "s"}`,
);
