/**
 * The compiler's own configuration and the layout manifest, both plain TypeScript files that live
 * in the installed package and belong to the project once installed.
 *
 *   contracts.config.ts      documentation chrome theme (required), documentation page header
 *                            (optional), an optional `componentsDir` and an optional `tokensDir`.
 *   figma-layout.config.ts   per-component geometry the CSS cannot state (optional).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { DocumentationPage, DocumentationTheme } from "../generation-contract";
import type { FigmaLayoutManifestEntry } from "../resolved-plan";
import { MissingPrerequisiteError } from "./prerequisites";

export const CONFIG_FILE = "contracts.config.ts";
export const DEFAULT_TOKENS_DIR = "packages/tokens/dtcg";
export const LAYOUT_MANIFEST_FILE = "figma-layout.config.ts";

export interface ContractsConfig {
  documentationTheme: DocumentationTheme;
  documentationPage?: DocumentationPage;
  /** Root-relative component directory. Overrides discovery from `components.json`. */
  componentsDir?: string;
  /** Root-relative folder of raw DTCG token sets. Defaults to `packages/tokens/dtcg`. */
  tokensDir?: string;
}

export type LayoutManifest = Record<string, Record<string, FigmaLayoutManifestEntry>>;

export async function loadContractsConfig(packageDir: string): Promise<ContractsConfig> {
  const path = join(packageDir, CONFIG_FILE);
  if (!existsSync(path)) {
    throw new MissingPrerequisiteError(
      `Missing ${path}. Restore the file from the package, or reinstall the contracts package ` +
        "with `shadcn add`.",
    );
  }
  const config = (await import(pathToFileURL(path).href)) as Partial<ContractsConfig>;
  if (!config.documentationTheme) {
    throw new MissingPrerequisiteError(
      `${path} must export documentationTheme (the token roles the documentation page uses).`,
    );
  }
  return {
    documentationTheme: config.documentationTheme,
    documentationPage: config.documentationPage,
    componentsDir: config.componentsDir,
    tokensDir: config.tokensDir,
  };
}

/** The layout manifest, or `{}` when the project has none. */
export async function loadLayoutManifest(packageDir: string): Promise<LayoutManifest> {
  const path = join(packageDir, LAYOUT_MANIFEST_FILE);
  if (!existsSync(path)) return {};
  const module = (await import(pathToFileURL(path).href)) as { FIGMA_LAYOUT_MANIFEST?: unknown };
  const manifest = module.FIGMA_LAYOUT_MANIFEST;
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error(`Expected FIGMA_LAYOUT_MANIFEST in ${path} to be an object.`);
  }
  return manifest as LayoutManifest;
}
