#!/usr/bin/env bun
/**
 * figma:docs:check — validates .agents/figma.config.json for Figma documentation
 * generation. Runs from the project root.
 *
 * Verifies:
 *   1. .agents/figma.config.json exists and is valid JSON.
 *   2. Required fields are present: uiPackage, figma.projectId, figma.planKey.
 *   3. If documentation.useDefault is false, a docConfigPath is specified.
 *
 * This is a pre-flight check before running @<dsname>/skill-figma-generate.
 * It does NOT make Figma API calls — for live Figma validation run the skill
 * with --preflight only.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const CONFIG_PATH = path.join(".agents", "figma.config.json");

interface FigmaConfig {
  uiPackage?: string;
  figma?: { projectId?: string; planKey?: string };
  documentation?: { useDefault?: boolean; docConfigPath?: string };
  _note?: string;
}

// ── Main ──────────────────────────────────────────────────────────────────────

if (!existsSync(CONFIG_PATH)) {
  console.error(
    `❌ figma:docs:check — ${CONFIG_PATH} not found.`,
    `\n   This file is seeded by the scaffolder when Figma is selected.`,
    `\n   If you added Figma items manually, create it from .agents/connect-to-figma.md.`,
  );
  process.exit(1);
}

let config: FigmaConfig;
try {
  config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
} catch (e) {
  console.error(`❌ figma:docs:check — failed to parse ${CONFIG_PATH}: ${e}`);
  process.exit(1);
}

const errors: string[] = [];

if (!config.uiPackage || typeof config.uiPackage !== "string") {
  errors.push(`uiPackage is missing or not a string (expected e.g. "@workspace/ui")`);
}

if (!config.figma) {
  errors.push(`figma object is missing (must have projectId and planKey)`);
} else {
  if (!config.figma.projectId) errors.push(`figma.projectId is missing`);
  if (!config.figma.planKey) errors.push(`figma.planKey is missing`);
}

if (config.documentation && config.documentation.useDefault === false) {
  if (!config.documentation.docConfigPath) {
    errors.push(
      `documentation.useDefault is false but documentation.docConfigPath is not set — ` +
        `point it at a module that exports a DocConfig`,
    );
  } else if (!existsSync(config.documentation.docConfigPath)) {
    errors.push(
      `documentation.docConfigPath "${config.documentation.docConfigPath}" does not exist`,
    );
  }
}

if (errors.length > 0) {
  console.error(`❌ figma:docs:check — ${CONFIG_PATH} has errors:`);
  for (const e of errors) console.error(`   • ${e}`);
  console.error(`\n   Edit ${CONFIG_PATH} to fix these, then re-run.`);
  process.exit(1);
}

const docMode =
  config.documentation?.useDefault === false ? "custom DocConfig" : "default DocConfig";
console.log(
  `✓ figma:docs:check — ${CONFIG_PATH} valid (pkg=${config.uiPackage}, project=${config.figma?.projectId}, ${docMode})`,
);
