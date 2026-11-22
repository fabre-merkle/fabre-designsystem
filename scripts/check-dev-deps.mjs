#!/usr/bin/env node
/**
 * Bootstrap guard — run via `bun run check-dev` before starting or building.
 * Fails fast with actionable guidance when:
 *
 *   1. Node < 24  (required by Next.js 16 + @vercel/sandbox runtime).
 *      Fix: nvm install 24 && nvm use 24  (or fnm — see .nvmrc)
 *
 *   2. node_modules not installed yet.
 *      Fix: bun install
 *
 * Both checks print a clear message and exit 1 so Turbo never starts.
 */
import { existsSync } from "node:fs";

const [major] = process.versions.node.split(".").map(Number);
if (major < 24) {
  console.error(
    `\n✗  Node ${process.versions.node} detected — this project requires Node ≥24.` +
      `\n   Switch versions:` +
      `\n     nvm:  nvm install 24 && nvm use 24` +
      `\n     fnm:  fnm install 24 && fnm use 24` +
      `\n   The .nvmrc in this repo pins the correct version.\n`,
  );
  process.exit(1);
}

if (!existsSync("node_modules")) {
  console.error(
    `\n✗  Dependencies not installed. Run:` +
      `\n     bun install` +
      `\n   then re-run: bun run dev\n`,
  );
  process.exit(1);
}
