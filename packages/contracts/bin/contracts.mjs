#!/usr/bin/env node
// Launches the contract compiler with Bun. This shim is plain JavaScript on purpose: it runs
// under Node, so a machine without Bun gets a clear message and exit code 3 instead of a shell
// "command not found".
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const entry = fileURLToPath(new URL("../src/project-compiler/cli.ts", import.meta.url));
// --no-install: dependencies come from `bun install` and the lockfile, never from a fetch at run
// time, so a missing one is reported (exit code 3) and a compile never runs on an unpinned version.
const result = spawnSync("bun", ["--no-install", entry, ...process.argv.slice(2)], {
  stdio: "inherit",
});

if (result.error && result.error.code === "ENOENT") {
  console.error(
    "Bun is required: the contract compiler is TypeScript source that Bun runs directly. " +
      "Install Bun (https://bun.sh) and run the command again.",
  );
  process.exit(3);
}
process.exit(result.status ?? 1);
