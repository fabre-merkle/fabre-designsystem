#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
/**
 * studio-exports-setup.ts — Create and run export presets from
 * .studio-push/exports/, then assemble optional consumer artifacts.
 *
 * For each JSON config in .studio-push/exports/, runs:
 *   studio exports create --name <name> --format css --config-file <file>
 * then runs general exports into ./css/. The optional unlayered split
 * `css-storefront` export is written to a temporary directory for the
 * Storefront bundle and unlayered semantic bridge, never over the general CSS tree.
 *
 * The regular `css` export still receives the Fumadocs Tailwind map transform.
 * Storefront is a declaration-level dependency closure generated from its
 * dedicated preset, gated by the same integration checks as its configuration.
 *
 * Run via `bun run tokens:studio:exports` after the initial push (project + tokens created).
 *
 * Auth: set TOKENS_STUDIO_TOKEN (service token) for non-interactive use, or authenticate
 * once with `studio auth login` (device flow) for local dev.
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { hasFumaDocsIntegration, hasStorefrontIntegration } from "./studio-push-prepare.ts";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../../..");
const EXPORTS_DIR = path.join(PROJECT_ROOT, ".studio-push/exports");
// `studio exports run … --out ./css/` writes relative to the calling process's
// CWD (packages/tokens/, per tokens:studio:exports) — not PROJECT_ROOT.
const CSS_DIR = path.join(PROJECT_ROOT, "packages/tokens/css");
const token = process.env.TOKENS_STUDIO_TOKEN;

function run(args: string[], tokenFile: string | undefined) {
  const fullArgs = tokenFile ? [...args, "--ci", "--service-token-file", tokenFile] : args;
  const printable = tokenFile
    ? fullArgs.join(" ").replace(tokenFile, "<token-file>")
    : fullArgs.join(" ");
  console.log(`  ▶ studio ${printable}`);
  const res = spawnSync("studio", fullArgs, { stdio: "inherit" });
  if (res.error) throw new Error(`Failed to launch studio CLI: ${res.error.message}`);
  if (res.status !== 0) throw new Error(`studio exited with status ${res.status}`);
}

export function createStorefrontExportStagingDir(packageRoot = path.dirname(CSS_DIR)): string {
  return mkdtempSync(path.join(packageRoot, ".storefront-export-"));
}

export function storefrontExportOutput(
  stagingDir: string,
  packageRoot = path.dirname(CSS_DIR),
): string {
  if (path.dirname(stagingDir) !== packageRoot) {
    throw new Error(
      `Storefront export staging directory must be inside the Studio working directory: ${packageRoot}`,
    );
  }
  return `./${path.basename(stagingDir)}/`;
}

export function copyStorefrontBridge(sourceDir: string, cssDir: string): void {
  const source = path.join(sourceDir, "semantic-storefront/default.css");
  const target = path.join(cssDir, "semantic-storefront/default.css");
  const css = readFileSync(source, "utf8");
  writeFileSync(target, css.endsWith("\n") ? css : `${css}\n`);
}

function main() {
  if (!existsSync(EXPORTS_DIR)) {
    console.error("✗ .studio-push/exports/ not found — run `bun run tokens:studio:prepare` first");
    process.exit(1);
  }

  const configFiles = readdirSync(EXPORTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  if (configFiles.length === 0) {
    console.log("No export configs in .studio-push/exports/ — nothing to do.");
    return;
  }

  const tmp = mkdtempSync(path.join(tmpdir(), "studio-exports-"));
  const storefrontTmp = createStorefrontExportStagingDir();
  let tokenFile: string | undefined;
  if (token) {
    tokenFile = path.join(tmp, "service-token");
    writeFileSync(tokenFile, token, { mode: 0o600 });
  }

  console.log(`▶ studio-exports-setup (${configFiles.length} export config(s))`);

  try {
    for (const configFileName of configFiles) {
      const exportName = configFileName.replace(/\.json$/, "");
      const configPath = path.join(EXPORTS_DIR, configFileName);
      // Path must be relative to the calling process's CWD (which is packages/tokens/ when
      // run via `bun run tokens:studio:exports`), not to the project root.
      const relConfigPath = path.relative(process.cwd(), configPath);

      console.log(`\n── ${exportName} ──`);

      // Check if the preset already exists; if so skip creation (idempotent reruns).
      const listResult = spawnSync(
        "studio",
        tokenFile
          ? ["exports", "list", "--ci", "--service-token-file", tokenFile]
          : ["exports", "list"],
        { encoding: "utf8" },
      );
      if (listResult.error || listResult.status !== 0) {
        throw new Error(
          `Unable to list Studio export presets: ${listResult.error?.message ?? listResult.stderr}`,
        );
      }
      const alreadyExists = new RegExp(`^\\s*${exportName}\\s`, "m").test(listResult.stdout);

      if (alreadyExists) {
        console.log(`  ℹ ${exportName} preset already exists — skipping create`);
      } else {
        run(
          [
            "exports",
            "create",
            "--name",
            exportName,
            "--format",
            "css",
            "--config-file",
            relConfigPath,
          ],
          tokenFile,
        );
      }

      const output =
        exportName === "css-storefront" ? storefrontExportOutput(storefrontTmp) : "./css/";
      run(["exports", "run", exportName, "--out", output], tokenFile);
      console.log(`  ✓ ${exportName} → ${output}`);
    }

    console.log(`\n✓ all exports ready (${configFiles.length} export(s))`);

    runPostExportTransforms(storefrontTmp);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
    rmSync(storefrontTmp, { recursive: true, force: true });
  }
}

/**
 * The `css` export's split layout isolates `semantic-fumadocs` and
 * `semantic-storefront` into their own files, but not in the shape their
 * consumers need — see the header comment and `studio-push-prepare.ts`. Runs
 * the two local transform scripts in place, each gated on the same
 * DTCG/bridge-CSS checks that decide whether the integration is installed at
 * all, so a project without fumadocs/Storefront does nothing extra here.
 */
function runPostExportTransforms(storefrontSourceDir: string) {
  const scriptsDir = import.meta.dirname;

  if (hasFumaDocsIntegration()) {
    console.log(`\n── post-export: fumadocs (@theme wrap) ──`);
    const res = spawnSync("node", [path.join(scriptsDir, "emit-fumadocs-theme.mjs"), CSS_DIR], {
      stdio: "inherit",
    });
    if (res.status !== 0) throw new Error("emit-fumadocs-theme.mjs failed");
  }

  if (hasStorefrontIntegration()) {
    console.log(`\n── post-export: Storefront dependency bundle ──`);
    const res = spawnSync(
      "bun",
      [
        path.join(scriptsDir, "build-storefront-bundle.ts"),
        storefrontSourceDir,
        path.join(CSS_DIR, "storefront/default.css"),
      ],
      { stdio: "inherit" },
    );
    if (res.status !== 0) throw new Error("build-storefront-bundle.ts failed");
    copyStorefrontBridge(storefrontSourceDir, CSS_DIR);
  }
}

if (import.meta.main) {
  main();
}
