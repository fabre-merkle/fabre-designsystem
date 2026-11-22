import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function run(args) {
  const result = spawnSync("bun", args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(["install"]);

const tokensPackagePath = "packages/tokens/package.json";
if (!existsSync(tokensPackagePath)) {
  console.log("No packages/tokens workspace found; local setup is complete.");
  process.exit(0);
}

const { scripts = {} } = JSON.parse(readFileSync(tokensPackagePath, "utf8"));
if (!scripts["tokens:studio:prepare"]) {
  console.log("Tokens Studio management is not enabled; local setup is complete.");
  process.exit(0);
}

run(["--cwd", "packages/tokens", "run", "tokens:setup"]);
run(["--cwd", "packages/tokens", "run", "tokens:studio:prepare"]);

console.log(`
Local setup is complete.

Next, follow .github/skills/skill-tokens-studio/SKILL.md with an agent that has
the Tokens Studio MCP configured. It will ask whether to create or select a
project before importing the prepared batches.
`);
