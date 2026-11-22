/**
 * Where a project keeps its components.
 *
 * Contracts are co-located with the components, so the compiler finds the component root the way
 * the project's own tooling does: through the `aliases.ui` entry of `components.json`. An
 * explicit `componentsDir` in the compiler config wins, and `packages/ui/src/components` is the
 * conventional default.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { MissingPrerequisiteError } from "./prerequisites";

export const DEFAULT_COMPONENTS_DIR = "packages/ui/src/components";

export interface ComponentsRoot {
  /** Absolute path of the directory holding one folder per component. */
  dir: string;
  /** Where the answer came from, for diagnostics. */
  source: string;
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function readJson(path: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function listDirs(dir: string): string[] {
  if (!isDirectory(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

/** Workspace packages by name, from `packages/*` and `apps/*` package.json files. */
function workspacePackages(root: string): Map<string, string> {
  const byName = new Map<string, string>();
  for (const group of ["packages", "apps"]) {
    for (const name of listDirs(join(root, group))) {
      const dir = join(root, group, name);
      const pkgName = readJson(join(dir, "package.json"))?.name;
      if (typeof pkgName === "string") byName.set(pkgName, dir);
    }
  }
  return byName;
}

/** Candidate directories an `aliases.ui` value can point at, most specific first. */
function aliasCandidates(alias: string, componentsJsonDir: string, root: string): string[] {
  if (alias.startsWith("@/") || alias.startsWith("~/")) {
    const rest = alias.slice(2);
    return [join(componentsJsonDir, "src", rest), join(componentsJsonDir, rest)];
  }
  const parts = alias.split("/");
  const scoped = alias.startsWith("@");
  const packageName = parts.slice(0, scoped ? 2 : 1).join("/");
  const rest = parts.slice(scoped ? 2 : 1).join("/");
  const packageDir = workspacePackages(root).get(packageName);
  if (!packageDir) return [];
  const candidates: string[] = [];
  const exportsField = readJson(join(packageDir, "package.json"))?.exports;
  if (exportsField && typeof exportsField === "object") {
    const entry = (exportsField as Record<string, unknown>)[`./${rest}/*`];
    const target =
      typeof entry === "string"
        ? entry
        : entry && typeof entry === "object"
          ? ((entry as Record<string, unknown>).import ??
            (entry as Record<string, unknown>).default)
          : undefined;
    if (typeof target === "string" && target.includes("/*")) {
      candidates.push(resolve(packageDir, target.slice(0, target.indexOf("/*"))));
    }
  }
  candidates.push(join(packageDir, "src", rest), join(packageDir, rest));
  return candidates;
}

/** `components.json` files, the root one first, then each `packages/*` one. */
function componentsJsonFiles(root: string): string[] {
  const files = [join(root, "components.json")];
  for (const name of listDirs(join(root, "packages"))) {
    files.push(join(root, "packages", name, "components.json"));
  }
  return files.filter((file) => existsSync(file));
}

/**
 * The component root of the project at `root`.
 *
 * @param override a root-relative directory from the compiler config; used when set.
 * @throws MissingPrerequisiteError when no component directory exists.
 */
export function discoverComponentsRoot(root: string, override?: string): ComponentsRoot {
  const tried: string[] = [];
  const attempt = (dir: string, source: string): ComponentsRoot | undefined => {
    tried.push(dir);
    return isDirectory(dir) ? { dir, source } : undefined;
  };

  if (override !== undefined) {
    const found = attempt(resolve(root, override), "componentsDir in the compiler config");
    if (found) return found;
  } else {
    for (const file of componentsJsonFiles(root)) {
      const alias = (readJson(file)?.aliases as Record<string, unknown> | undefined)?.ui;
      if (typeof alias !== "string") continue;
      const componentsJsonDir = resolve(file, "..");
      for (const candidate of aliasCandidates(alias, componentsJsonDir, root)) {
        const found = attempt(candidate, `aliases.ui "${alias}" in ${file}`);
        if (found) return found;
      }
    }
    const fallback = attempt(
      join(root, DEFAULT_COMPONENTS_DIR),
      `the default ${DEFAULT_COMPONENTS_DIR}`,
    );
    if (fallback) return fallback;
  }

  throw new MissingPrerequisiteError(
    `No component directory found. Looked in: ${tried.join(", ")}. ` +
      "Install a component, point aliases.ui in components.json at the directory that holds them, " +
      "or set componentsDir in the compiler config.",
    "no-contracts",
  );
}

/** Component folders (one per component), sorted the way the artifact orders them. */
export function componentDirectories(componentsRoot: string): string[] {
  return listDirs(componentsRoot);
}
