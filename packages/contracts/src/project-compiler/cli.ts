#!/usr/bin/env bun
/**
 * Command line entry of the contract compiler.
 *
 *   bun src/project-compiler/cli.ts <command> [--root <dir>]
 *
 * Commands: compile, check, validate <slug>, list, explain <slug>, new <slug>. Run it with
 * `--help` for the full list, the flags and an example of each; those texts come from
 * `commands.ts`, which is the one place the commands are defined.
 *
 * Exit codes: 0 success, 1 a contract was refused or the artifact is stale, 2 usage, 3 a
 * prerequisite is missing (the message names the remedy).
 *
 * The prerequisite checks run before anything that needs a dependency is imported, so a missing
 * dependency is reported as exit 3 rather than as an import failure. The parser is loaded
 * afterwards, for the same reason.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type ExitCode, requireBun, requireDependencies } from "./prerequisites";
import type { Output } from "./program";
import type { Prompter } from "./prompts";
import { exitCodeOfError, failureReport, renderErrorText, renderJson } from "./report";

const STDIO: Output = {
  out: (text) => {
    process.stdout.write(text);
  },
  err: (text) => {
    process.stderr.write(text);
  },
};

/** The installed package: this file lives in `<package>/src/project-compiler/`. */
const PACKAGE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function main(
  argv: readonly string[],
  cwd: string = process.cwd(),
  packageDir: string = PACKAGE_DIR,
  output: Output = STDIO,
  interactive: boolean = process.stdin.isTTY === true && process.stdout.isTTY === true,
  prompter?: Prompter,
): Promise<ExitCode> {
  try {
    requireBun();
    requireDependencies(packageDir);
    const { runProgram } = await import("./program");
    return await runProgram(argv, { cwd, packageDir, interactive, prompter }, output);
  } catch (error) {
    if (argv.includes("--json")) {
      const command = argv.find((word) => !word.startsWith("-"));
      output.out(`${renderJson(failureReport(command, error))}\n`);
    } else {
      output.err(`${renderErrorText(error)}\n`);
    }
    return exitCodeOfError(error);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(await main(process.argv.slice(2)));
}
