#!/usr/bin/env bun
/**
 * studio-push-prepare.ts — Prepares payload artifacts for the initial Tokens Studio push.
 *
 * Reads packages/tokens/dtcg/, flattens nested DTCG to flat token records, chunks into
 * batches of ≤200, and emits .studio-push/ payloads ready for the push skill to consume
 * via the Tokens Studio MCP (tokens_batch_create + themes tool calls).
 *
 * Also emits the general CSS config and, when Storefront is installed, a dedicated
 * unlayered `css-storefront` split config. Studio has no token-set filter:
 * `fileLayout: "single"` would dump the whole project, so it is never used for
 * Storefront. The dedicated split preset is exported to a temporary directory;
 * `build-storefront-bundle.ts` then selects and validates the declaration-level
 * dependency closure required by semantic-storefront. The general `css` preset
 * remains the source for ordinary split output and Fumadocs' @theme transform.
 * `hasFumaDocsIntegration()` / `hasStorefrontIntegration()` gate each optional
 * consumer output.
 *
 * Usage:  bun packages/tokens/scripts/studio-push-prepare.ts [--dry-run]
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const DRY_RUN = process.argv.includes("--dry-run");
/** Tokens Studio MCP accepts at most 200 token records per batch. */
const CHUNK_SIZE = 200;

// Resolve project root (3 levels up from packages/tokens/scripts/)
const PROJECT_ROOT = path.resolve(import.meta.dirname, "../../..");
const DTCG_DIR = path.join(PROJECT_ROOT, "packages/tokens/dtcg");
const OUTPUT_DIR = path.join(PROJECT_ROOT, ".studio-push");

// --- Helpers ---

/** Derive the DS namespace prefix from packages/tokens/package.json name. */
function derivePrefix(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(path.join(PROJECT_ROOT, "packages/tokens/package.json"), "utf8"),
    );
    const name = (pkg.name ?? "") as string;
    if (name.startsWith("@")) {
      return name.slice(1, name.indexOf("/"));
    }
    return name.split("/")[0] ?? "tokens";
  } catch {
    return "tokens";
  }
}

/**
 * True when this project has apps/docs AND the semantic-fumadocs DTCG set.
 * Exported for testing with injected paths and for `studio-exports-setup.ts`,
 * which uses it to decide whether to run the fumadocs post-export transform.
 */
export function hasFumaDocsIntegration(dtcgDir = DTCG_DIR, projectRoot = PROJECT_ROOT): boolean {
  if (!existsSync(path.join(projectRoot, "apps/docs"))) return false;
  return existsSync(path.join(dtcgDir, "semantic-fumadocs"));
}

/**
 * True when this project has the semantic-storefront DTCG set AND the bridge
 * CSS installed by @focus/tokens-storefront-bridge. Both must be present: the
 * DTCG alone ships with @focus/tokens-default-theme-dtcg for raw-schema consumers
 * and must not trigger the css-storefront preset without an explicit opt-in.
 * Exported for testing with injected paths.
 */
export function hasStorefrontIntegration(dtcgDir = DTCG_DIR, projectRoot = PROJECT_ROOT): boolean {
  if (!existsSync(path.join(dtcgDir, "semantic-storefront"))) return false;
  return existsSync(path.join(projectRoot, "packages/tokens/css/semantic-storefront/default.css"));
}

// --- DTCG flattening ---

export interface FlatToken {
  token_set_name: string;
  name: string;
  type: string;
  value: string | number | boolean | object;
  description?: string;
}

export interface PushSummary {
  tokenCount: number;
  tokenSetCount: number;
  chunkCount: number;
  chunkSize: number;
}

export function makePushSummary(
  tokens: readonly FlatToken[],
  tokenSetCount: number,
  chunkCount: number,
): PushSummary {
  return {
    tokenCount: tokens.length,
    tokenSetCount,
    chunkCount,
    chunkSize: CHUNK_SIZE,
  };
}

export function chunkTokens(tokens: readonly FlatToken[]): FlatToken[][] {
  const chunks: FlatToken[][] = [];
  for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
    chunks.push(tokens.slice(i, i + CHUNK_SIZE));
  }
  return chunks;
}

function isTokenNode(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === "object" && obj !== null && "$value" in (obj as object);
}

/** Collect token records, including named descendants of Studio value-bearing nodes. */
export function flattenTokenFile(filePath: string, tokenSetName: string): FlatToken[] {
  const content: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  const result: FlatToken[] = [];

  function walk(node: unknown, segments: string[]) {
    if (typeof node !== "object" || node === null) return;
    if (isTokenNode(node)) {
      result.push({
        token_set_name: tokenSetName,
        name: segments.join("."),
        type: (node.$type as string) ?? "other",
        value: node.$value as string | number | boolean | object,
        ...(node.$description ? { description: node.$description as string } : {}),
      });
    }
    // Studio's authored tree can carry both a base value and named states.
    // Skip $value itself so composite token contents never become extra records.
    for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
      if (key.startsWith("$")) continue;
      walk(val, [...segments, key]);
    }
  }

  walk(content, []);
  return result;
}

const META_FILES = new Set(["$themes.json", "$metadata.json", "studio.lock"]);
const TOKEN_SET_DEPENDENCY_PREFIXES = [
  "primitive/",
  "foundation/",
  "global/",
  "brand/",
  "theme/",
  "semantic-web/",
  "web/",
  "semantic-fumadocs/",
  "semantic-storefront/",
  "component/",
];

/** Walk dtcg/ and return all token JSON files with their computed set names. */
function collectDtcgFiles(): Array<{ file: string; setName: string }> {
  const results: Array<{ file: string; setName: string }> = [];
  function walk(dir: string, relBase: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(full, rel);
      } else if (entry.isFile() && entry.name.endsWith(".json") && !META_FILES.has(entry.name)) {
        results.push({ file: full, setName: rel.replace(/\.json$/, "") });
      }
    }
  }
  if (existsSync(DTCG_DIR)) walk(DTCG_DIR, "");

  const metadataPath = path.join(DTCG_DIR, "$metadata.json");
  let tokenSetOrder: string[] = [];
  if (existsSync(metadataPath)) {
    const metadata = JSON.parse(readFileSync(metadataPath, "utf8")) as {
      tokenSetOrder?: unknown;
    };
    if (Array.isArray(metadata.tokenSetOrder)) {
      tokenSetOrder = metadata.tokenSetOrder.filter(
        (setName): setName is string => typeof setName === "string",
      );
    }
  }
  const orderBySet = new Map(tokenSetOrder.map((setName, index) => [setName, index]));
  const dependencyRank = (setName: string) => {
    const index = TOKEN_SET_DEPENDENCY_PREFIXES.findIndex((prefix) => setName.startsWith(prefix));
    return index === -1 ? TOKEN_SET_DEPENDENCY_PREFIXES.length : index;
  };
  results.sort((a, b) => {
    const rankDifference = dependencyRank(a.setName) - dependencyRank(b.setName);
    if (rankDifference !== 0) return rankDifference;
    const aIndex = orderBySet.get(a.setName) ?? Number.MAX_SAFE_INTEGER;
    const bIndex = orderBySet.get(b.setName) ?? Number.MAX_SAFE_INTEGER;
    return aIndex - bIndex || a.setName.localeCompare(b.setName);
  });
  return results;
}

// --- Export config builders ---

/**
 * Selector for the dimension-free layers (foundation, semantic, component). Re-declaring them on
 * every brand/theme/web scope lets a nested `[data-theme]` or `[data-brand]` subtree re-resolve its
 * semantic aliases instead of inheriting values resolved once at `:root`.
 */
export const TOKEN_ROOT_SELECTOR = ":root, [data-brand], [data-theme], [data-web]";

export function makeCssExportConfig(prefix: string): object {
  return {
    colorSpace: "as-authored",
    defaultStrategy: "data-attribute",
    naming: { casing: "kebab" },
    layers: { enabled: true, prefix: `${prefix}-` },
    rootSelector: TOKEN_ROOT_SELECTOR,
    minify: false,
    sourceComments: false,
    descriptionComments: false,
    fileLayout: "split",
    baseFileName: "base",
  };
}

export function makeStorefrontCssExportConfig(prefix: string): object {
  return {
    ...makeCssExportConfig(prefix),
    layers: { enabled: false, prefix: `${prefix}-` },
    wrapInTheme: false,
    rootSelector: ":root",
  };
}

// --- Main ---

function main() {
  if (!existsSync(DTCG_DIR)) {
    console.error(`✗ packages/tokens/dtcg/ not found at ${DTCG_DIR}`);
    console.error("  Run `bun run tokens:pull` first to populate dtcg/.");
    process.exit(1);
  }

  const prefix = derivePrefix();
  const includeFumadocs = hasFumaDocsIntegration();
  const includeStorefront = hasStorefrontIntegration();

  console.log(`▶ studio-push-prepare`);
  console.log(
    `  prefix: ${prefix}, fumadocs post-export transform: ${includeFumadocs}, storefront post-export transform: ${includeStorefront}`,
  );

  const dtcgFiles = collectDtcgFiles();

  const allTokens: FlatToken[] = [];
  for (const { file, setName } of dtcgFiles) {
    try {
      const tokens = flattenTokenFile(file, setName);
      allTokens.push(...tokens);
    } catch (e) {
      console.warn(`  ⚠ skipped ${setName}: ${e instanceof Error ? e.message : e}`);
    }
  }

  const chunks = chunkTokens(allTokens);

  const themesPath = path.join(DTCG_DIR, "$themes.json");
  const themes = existsSync(themesPath) ? JSON.parse(readFileSync(themesPath, "utf8")) : [];

  console.log(
    `  ${allTokens.length} tokens across ${dtcgFiles.length} sets → ${chunks.length} chunks of ≤${CHUNK_SIZE}`,
  );
  console.log(`  ${themes.length} theme entries`);
  console.log(`  export configs: css${includeStorefront ? ", css-storefront" : ""}`);
  if (includeFumadocs) console.log(`  post-export transform: fumadocs (@theme wrap)`);
  if (includeStorefront) console.log(`  post-export transform: storefront (single bundle)`);

  if (DRY_RUN) {
    console.log("\n  (dry run — no files written)");
    return;
  }

  // Clear stale artifacts before writing fresh output so reruns don't leave
  // orphaned chunk-*.json from a previous run.
  if (existsSync(path.join(OUTPUT_DIR, "chunks"))) {
    rmSync(path.join(OUTPUT_DIR, "chunks"), { recursive: true, force: true });
  }
  rmSync(path.join(OUTPUT_DIR, "exports", "css-fumadocs.json"), { force: true });

  mkdirSync(path.join(OUTPUT_DIR, "chunks"), { recursive: true });
  mkdirSync(path.join(OUTPUT_DIR, "exports"), { recursive: true });

  for (let i = 0; i < chunks.length; i++) {
    writeFileSync(
      path.join(OUTPUT_DIR, "chunks", `chunk-${String(i + 1).padStart(3, "0")}.json`),
      JSON.stringify(chunks[i], null, 2),
    );
  }

  writeFileSync(path.join(OUTPUT_DIR, "themes.json"), JSON.stringify(themes, null, 2));
  writeFileSync(
    path.join(OUTPUT_DIR, "summary.json"),
    JSON.stringify(makePushSummary(allTokens, dtcgFiles.length, chunks.length), null, 2),
  );

  writeFileSync(
    path.join(OUTPUT_DIR, "exports", "css.json"),
    JSON.stringify(makeCssExportConfig(prefix), null, 2),
  );
  if (includeStorefront) {
    writeFileSync(
      path.join(OUTPUT_DIR, "exports", "css-storefront.json"),
      JSON.stringify(makeStorefrontCssExportConfig(prefix), null, 2),
    );
  }

  console.log(`\n✓ ready — run skill-tokens-studio to push to Tokens Studio`);
}

if (import.meta.main) main();
