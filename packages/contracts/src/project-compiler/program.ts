/**
 * The command-line parser wiring: the only module that imports `commander`.
 *
 * It builds the parser from the command definitions (`commands.ts`), so names, arguments, flags,
 * help text and examples are never written here, and hands each parsed command to its handler
 * (`handlers.ts`), so no behaviour is written here either. Replacing the parser means rewriting
 * this file and nothing else.
 *
 * `cli.ts` loads this module only after the prerequisite checks, so a missing `commander` is
 * reported as exit code 3 with the remedy instead of as an import failure.
 */
import { Command, CommanderError } from "commander";
import { diagnostic, diagnosticReference } from "../generation-contract/diagnostics";
import {
  COMMANDS,
  type CommandDefinition,
  EXIT_CODES,
  PROGRAM_DESCRIPTION,
  PROGRAM_NAME,
} from "./commands";
import { type CommandEnvironment, type CommandResult, runCommand } from "./handlers";
import { EXIT, type ExitCode } from "./prerequisites";
import { renderJson, renderWarningsText } from "./report";

/** Where output goes. Text is written exactly as given, so include the final newline. */
export interface Output {
  out(text: string): void;
  err(text: string): void;
}

function examplesText(definition: CommandDefinition): string {
  const width = Math.max(...definition.examples.map((example) => example.command.length));
  const lines = definition.examples.map(
    (example) =>
      `  ${PROGRAM_NAME} ${example.command.padEnd(width)}  ${example.description} (exit ${example.exit})`,
  );
  return `\nExamples:\n${lines.join("\n")}\n`;
}

function exitCodesText(): string {
  const lines = EXIT_CODES.map((entry) => `  ${entry.code}  ${entry.meaning}`);
  return `\nExit codes:\n${lines.join("\n")}\n`;
}

function diagnosticsText(): string {
  const entries = diagnosticReference();
  const width = Math.max(...entries.map((entry) => entry.code.length));
  const lines = entries.map(
    (entry) =>
      `  ${entry.code.padEnd(width)}  ${entry.severity === "warning" ? "warning" : `exit ${entry.exit ?? 1}`}  ${entry.message}`,
  );
  return `\nDiagnostic codes (stable; \`--json\` prints each with its path, message and remedy):\n${lines.join("\n")}\n`;
}

export function buildProgram(
  env: CommandEnvironment,
  output: Output,
  onResult: (result: CommandResult, json: boolean) => void,
): Command {
  const program = new Command();
  program
    .name(PROGRAM_NAME)
    .description(PROGRAM_DESCRIPTION)
    .exitOverride()
    .configureOutput({ writeOut: output.out, writeErr: output.err })
    .showHelpAfterError()
    .addHelpText("after", exitCodesText())
    .addHelpText("after", diagnosticsText());

  for (const definition of COMMANDS) {
    const command = program
      .command(definition.name)
      .summary(definition.summary)
      .description(definition.description);
    for (const argument of definition.arguments) {
      command.argument(
        argument.required ? `<${argument.name}>` : `[${argument.name}]`,
        argument.description,
      );
    }
    for (const option of definition.options) command.option(option.flags, option.description);
    command.addHelpText("after", examplesText(definition));
    command.action(async (...received: unknown[]) => {
      const parsed = received[received.length - 1] as Command;
      const options = parsed.opts<{
        root?: string;
        force?: boolean;
        json?: boolean;
        yes?: boolean;
      }>();
      const result = await runCommand(definition.name, { slug: parsed.args[0], options }, env);
      onResult(result, options.json === true);
    });
  }
  return program;
}

/**
 * Parses `argv`, runs the command and prints its result. Returns the exit code.
 *
 * Help requested on purpose exits 0. Anything the parser rejects (no command, an unknown command
 * or flag, a missing argument) is a usage error, exit 2, with the parser's message and the help.
 * An error thrown by a handler propagates to the caller.
 */
export async function runProgram(
  argv: readonly string[],
  env: CommandEnvironment,
  output: Output,
): Promise<ExitCode> {
  let result: CommandResult | undefined;
  let json = false;
  let command: string | undefined;
  // With --json the parser's own text (error and help) is held back, so a usage error can still
  // be one JSON document. Help requested on purpose is released as text.
  const wantsJson = argv.includes("--json");
  const held: string[] = [];
  const parserOutput: Output = wantsJson
    ? { out: (text) => held.push(text), err: (text) => held.push(text) }
    : output;
  const program = buildProgram(env, parserOutput, (value, asJson) => {
    result = value;
    json = asJson;
    command = argv.find((word) => !word.startsWith("-"));
  });
  try {
    await program.parseAsync(argv, { from: "user" });
  } catch (error) {
    if (error instanceof CommanderError) {
      if (error.exitCode === 0) {
        for (const text of held) output.out(text);
        return EXIT.ok;
      }
      if (wantsJson) {
        output.out(
          `${renderJson({
            command: argv.find((word) => !word.startsWith("-")),
            ok: false,
            exitCode: EXIT.usage,
            diagnostics: [diagnostic("usage-invalid", error.message.replace(/^error:\s*/, ""))],
          })}\n`,
        );
      }
      return EXIT.usage;
    }
    throw error;
  }
  if (result) {
    if (json) {
      output.out(
        `${renderJson({
          command,
          ok: result.exitCode === EXIT.ok,
          exitCode: result.exitCode,
          diagnostics: result.diagnostics,
          data: result.data,
        })}\n`,
      );
      return result.exitCode;
    }
    if (result.out) output.out(`${result.out}\n`);
    if (result.err) output.err(`${result.err}\n`);
    const warnings = renderWarningsText(result.diagnostics);
    if (warnings) output.err(`${warnings}\n`);
    return result.exitCode;
  }
  return EXIT.ok;
}
