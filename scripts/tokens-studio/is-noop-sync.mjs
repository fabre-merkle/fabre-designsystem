#!/usr/bin/env node
// Decides whether a token-sync run produced a real change or only Studio lockfile
// metadata churn. A pull rewrites `packages/tokens/studio.lock` on every run
// (`generated_at`, `cli_version`, `updated_at`, `modified_at`, `lockfile_hash`) even
// when no token changed; opening a PR for that is noise.
//
// Content-bearing lock fields (`content_hash`, per-file `hash`/`size`/`tokens`/`path`,
// `output_hash`, `preset_hash`, refs, names) are NEVER ignored: if any differs from
// HEAD, the sync is real.
//
// Usage (run from the repo root, after the pull + regenerate steps):
//   node is-noop-sync.mjs [--lock <path>] [--scope <path>]...
// --scope limits which changed paths count (use the create-pull-request add-paths);
// default is every changed path. On a no-op the lock is restored from HEAD and
// `noop=true` is written to $GITHUB_OUTPUT; otherwise `noop=false`.
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

export const DEFAULT_LOCK = "packages/tokens/studio.lock";

// Lock keys that only record when/how the lock was written, not what it pins.
const METADATA_LINE = /^\s*(generated_at|cli_version|updated_at|modified_at|lockfile_hash)\s*=/;

export function stripLockMetadata(text) {
  return text
    .split("\n")
    .filter((line) => !METADATA_LINE.test(line))
    .join("\n");
}

function inScope(file, scope) {
  if (!scope || scope.length === 0) return true;
  return scope.some((s) => {
    const dir = s.replace(/\/+$/, "");
    return file === dir || file.startsWith(`${dir}/`);
  });
}

/**
 * @param {{ changedPaths: string[], lockBefore: string | null, lockAfter: string | null,
 *   lockPath?: string, scope?: string[] }} input
 * @returns {boolean} true when nothing but lock metadata changed (or nothing changed)
 */
export function isNoopSync({
  changedPaths,
  lockBefore,
  lockAfter,
  lockPath = DEFAULT_LOCK,
  scope,
}) {
  const relevant = changedPaths.filter((f) => inScope(f, scope));
  const others = relevant.filter((f) => f !== lockPath);
  if (others.length > 0) return false;
  if (!relevant.includes(lockPath)) return true;
  if (lockBefore == null || lockAfter == null) return false; // added or deleted
  return stripLockMetadata(lockBefore) === stripLockMetadata(lockAfter);
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function changedPathsFromGit() {
  const out = git(["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  const entries = out.split("\0").filter(Boolean);
  const paths = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    paths.push(entry.slice(3));
    if (entry[0] === "R" || entry[0] === "C") i++; // skip the rename source
  }
  return paths;
}

function readHead(file) {
  try {
    return git(["show", `HEAD:${file}`]);
  } catch {
    return null;
  }
}

function readWorking(file) {
  try {
    return execFileSync("cat", [file], { encoding: "utf8" });
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const opts = { lockPath: DEFAULT_LOCK, scope: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--lock") opts.lockPath = argv[++i];
    else if (argv[i] === "--scope") opts.scope.push(argv[++i]);
  }
  return opts;
}

function main() {
  const { lockPath, scope } = parseArgs(process.argv.slice(2));
  const changedPaths = changedPathsFromGit();
  const noop = isNoopSync({
    changedPaths,
    lockBefore: readHead(lockPath),
    lockAfter: readWorking(lockPath),
    lockPath,
    scope,
  });
  if (noop) {
    if (changedPaths.includes(lockPath)) git(["checkout", "--", lockPath]);
    console.log(`::notice::No token changes: only ${lockPath} metadata changed. Skipping PR.`);
  } else {
    console.log("Token changes detected; a PR will be opened or updated.");
  }
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `noop=${noop}\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
