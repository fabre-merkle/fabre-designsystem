#!/usr/bin/env bun
/**
 * tokens:setup — one-time bootstrap of the @tokens-studio/studio-cli platform binary.
 * Idempotent: the installer checks for an existing binary and no-ops if present.
 *
 * Background: the studio-cli npm package ships JS-only; its platform binary is
 * downloaded by a `postinstall` script that Bun gates by default. This script runs
 * the installer directly, bypassing the gate.
 *
 * Do NOT add @tokens-studio/studio-cli to trustedDependencies — its postinstall
 * renames files across device boundaries on Vercel, causing an EXDEV error that
 * breaks every production build. The binary is a local dev tool; the build pipeline
 * only consumes the committed css/*.css.
 *
 * Run: bun run tokens:setup
 * Then verify: studio --version (or bunx studio --version)
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const installScript = path.join("node_modules", "@tokens-studio", "studio-cli", "install.js");
const binary = path.join("node_modules", "@tokens-studio", "studio-cli", "vendor", "studio");

if (existsSync(binary)) {
  console.log("tokens:setup — Studio CLI binary is already installed.");
  process.exit(0);
}

if (!existsSync(installScript)) {
  console.error(
    "tokens:setup — @tokens-studio/studio-cli not found in node_modules.\n" +
      "  Run bun install from packages/tokens (or the workspace root) first.",
  );
  process.exit(1);
}

console.log("tokens:setup — installing the Studio CLI binary…");
const result = spawnSync(process.execPath, [installScript], { stdio: "inherit" });
if (result.error) throw new Error(`Failed to run Studio CLI installer: ${result.error.message}`);
if (result.status !== 0) process.exit(result.status ?? 1);
if (!existsSync(binary))
  throw new Error("Studio CLI installer completed without creating its binary.");

console.log("tokens:setup — Studio CLI binary installed.");
