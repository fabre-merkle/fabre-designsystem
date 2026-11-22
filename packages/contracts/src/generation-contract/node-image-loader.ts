import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { CompileGenerationContractInput } from "./types";

/**
 * A `CompileGenerationContractInput.resolveImageAsset` implementation backed by the real
 * filesystem: resolves a contract's declared `imageAssetPath` relative to `componentDir` (or, if
 * omitted, `join(process.cwd(), dirname(componentPath))` — safe only when the caller's cwd is the
 * repo root, true for `bun test`/a script invoked from the repo root but NOT for a per-package
 * `turbo run test`, whose cwd is that package's own directory).
 */
export function createNodeImageAssetResolver(
  componentDir?: string,
): NonNullable<CompileGenerationContractInput["resolveImageAsset"]> {
  return (assetPath: string, componentPath: string) => {
    const resolvedDir = componentDir ?? join(process.cwd(), dirname(componentPath));
    const baseDir = resolve(resolvedDir);
    const fullPath = resolve(baseDir, assetPath);
    // Containment check: a declared `imageAssetPath` must resolve to somewhere
    // inside the component's own directory. Without this, `../../secrets.env`
    // or an absolute path (e.g. `/etc/passwd`) escapes `resolvedDir` — this
    // compiles fine in the monorepo (everything lives under one tree) but in a
    // scaffolded project only `@ui/<slug>/` is installed, so the same contract
    // could embed arbitrary files from outside the component. `relative()`
    // is empty for the same path, starts with `..` for anything above
    // `baseDir`, and is never itself absolute on POSIX/Windows once the input
    // is absolute — all three are rejected.
    const rel = relative(baseDir, fullPath);
    if (rel !== "" && (rel.startsWith("..") || isAbsolute(rel))) {
      throw new Error(
        `Image asset "${assetPath}" (declared on component "${componentPath}") resolves outside ` +
          `its component directory ("${baseDir}") — imageAssetPath must stay within the component.`,
      );
    }
    if (!existsSync(fullPath)) {
      throw new Error(`Image asset not found: "${fullPath}".`);
    }
    const stat = statSync(fullPath);
    if (!stat.isFile()) {
      throw new Error(`Image asset is not a readable file: "${fullPath}".`);
    }
    const bytes = readFileSync(fullPath);
    return { bytes: new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength) };
  };
}
