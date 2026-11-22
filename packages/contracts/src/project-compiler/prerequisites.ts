/**
 * The installation contract of the contract compiler, as code.
 *
 * The compiler is TypeScript source run directly by Bun inside a `packages/*` workspace, so
 * three things must hold before it can do anything: Bun is the runtime, a workspace root exists,
 * and the package's runtime dependencies (zod, commander, postcss, postcss-selector-parser) are installed. Each failure carries the remedy, and
 * all of them exit with code 3 ("missing prerequisite"), the same code in every command.
 *
 * Only `node:` modules are imported here, so these checks run before any dependency is loaded.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  type Diagnostic,
  type DiagnosticCode,
  diagnostic,
} from "../generation-contract/diagnostics";

/** Exit codes shared by every command. */
export const EXIT = {
  ok: 0,
  /** A contract or artifact was refused, or the artifact is stale. */
  refusal: 1,
  usage: 2,
  /** A prerequisite is missing; the message carries the remedy. */
  missingPrerequisite: 3,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

/**
 * An error that maps to a specific exit code. Anything else thrown is a refusal (exit 1). It
 * carries the diagnostic it reports: a stable code, the message and the remedy.
 */
export class ContractsError extends Error {
  readonly exitCode: ExitCode;
  readonly diagnostics: Diagnostic[];

  constructor(
    message: string,
    exitCode: ExitCode,
    code: DiagnosticCode = exitCode === EXIT.usage
      ? "slug-invalid"
      : exitCode === EXIT.missingPrerequisite
        ? "dependency-missing"
        : "contract-refused",
    path = "",
  ) {
    super(message);
    this.name = "ContractsError";
    this.exitCode = exitCode;
    this.diagnostics = [diagnostic(code, message, path)];
  }
}

export class MissingPrerequisiteError extends ContractsError {
  constructor(message: string, code: DiagnosticCode = "dependency-missing", path = "") {
    super(message, EXIT.missingPrerequisite, code, path);
    this.name = "MissingPrerequisiteError";
  }
}

export class UsageError extends ContractsError {
  constructor(message: string, code: DiagnosticCode = "slug-invalid", path = "") {
    super(message, EXIT.usage, code, path);
    this.name = "UsageError";
  }
}

/** The runtime dependencies the compiler imports. */
export const RUNTIME_DEPENDENCIES = [
  "zod",
  "commander",
  "postcss",
  "postcss-selector-parser",
] as const;

export function requireBun(
  running: boolean = (globalThis as { Bun?: unknown }).Bun !== undefined,
): void {
  if (!running) {
    throw new MissingPrerequisiteError(
      "Bun is required: the contract compiler is TypeScript source that Bun runs directly. " +
        "Install Bun (https://bun.sh) and run the command again.",
      "bun-missing",
    );
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

/** The workspace globs of a package.json: `workspaces: [...]` or `workspaces: { packages: [...] }`. */
export function workspaceGlobs(pkg: Record<string, unknown> | undefined): string[] {
  const workspaces = pkg?.workspaces;
  const list = Array.isArray(workspaces)
    ? workspaces
    : workspaces && typeof workspaces === "object"
      ? (workspaces as { packages?: unknown }).packages
      : undefined;
  return Array.isArray(list) ? list.filter((g): g is string => typeof g === "string") : [];
}

function declaresPackagesWorkspace(dir: string): boolean {
  const globs = workspaceGlobs(readJson(join(dir, "package.json")));
  return globs.some(
    (glob) => glob === "packages" || glob.replace(/^\.\//, "").startsWith("packages/"),
  );
}

const WORKSPACE_REMEDY =
  "Run the command from inside the project, pass --root <dir>, or add " +
  '"workspaces": ["packages/*"] to the root package.json.';

/**
 * The project root: `explicitRoot` when given, otherwise the nearest ancestor of `startDir` whose
 * package.json declares a `packages/*` workspace.
 */
export function findWorkspaceRoot(startDir: string, explicitRoot?: string): string {
  if (explicitRoot !== undefined) {
    const root = resolve(startDir, explicitRoot);
    if (!declaresPackagesWorkspace(root)) {
      throw new MissingPrerequisiteError(
        `${root} is not a workspace root: its package.json does not declare a packages/* workspace. ` +
          WORKSPACE_REMEDY,
        "workspace-root-missing",
      );
    }
    return root;
  }
  let dir = resolve(startDir);
  for (;;) {
    if (existsSync(join(dir, "package.json")) && declaresPackagesWorkspace(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new MissingPrerequisiteError(
    `No workspace root found from ${resolve(startDir)}: no package.json above it declares a ` +
      `packages/* workspace. ${WORKSPACE_REMEDY}`,
    "workspace-root-missing",
  );
}

/**
 * Throws when a runtime dependency cannot be resolved from the package. `resolver` defaults to
 * Bun's resolver and exists so the check can be tested without uninstalling anything.
 */
export function requireDependencies(
  packageDir: string,
  resolver: (name: string, from: string) => string = (name, from) =>
    (
      globalThis as unknown as { Bun: { resolveSync(n: string, f: string): string } }
    ).Bun.resolveSync(name, from),
  names: readonly string[] = RUNTIME_DEPENDENCIES,
): void {
  const missing: string[] = [];
  for (const name of names) {
    try {
      resolver(name, packageDir);
    } catch {
      missing.push(name);
    }
  }
  if (missing.length > 0) {
    throw new MissingPrerequisiteError(
      `Missing dependenc${missing.length === 1 ? "y" : "ies"} ${missing.join(", ")} for the contract compiler. ` +
        "Run `bun install` at the workspace root.",
    );
  }
}
