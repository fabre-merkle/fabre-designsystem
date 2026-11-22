/**
 * How a command's outcome is printed: text for people, one JSON document for scripts and agents.
 *
 * Both render the same diagnostics (see `generation-contract/diagnostics.ts`): a stable code, a
 * severity, a path (contract slug plus JSON pointer), a message and a remedy. Imports nothing but
 * the diagnostics, so `cli.ts` can print a failure even when the command-line parser cannot load.
 */
import {
  type Diagnostic,
  diagnostic,
  exitCodeOf,
  RefusalError,
} from "../generation-contract/diagnostics";
import { ContractsError, EXIT, type ExitCode } from "./prerequisites";

/** The document `--json` prints, for a success and for a failure alike. */
export interface JsonReport {
  command: string | undefined;
  ok: boolean;
  exitCode: ExitCode;
  diagnostics: Diagnostic[];
  /** What the command produced (a report, a list, the outcome of a compile). Absent on a failure. */
  data?: unknown;
}

/** The diagnostics a thrown error stands for. Anything that is not a compiler error is a refusal. */
export function diagnosticsOfError(error: unknown): Diagnostic[] {
  if (error instanceof ContractsError || error instanceof RefusalError) {
    const slug = leadingSlug(error.message);
    return error.diagnostics.map((item) => (item.path || !slug ? item : { ...item, path: slug }));
  }
  const message = error instanceof Error ? error.message : String(error);
  return [diagnostic("contract-refused", message, leadingSlug(message) ?? "")];
}

/** Engine messages start with the contract they are about, quoted: `"toggle-group" slot ...`. */
function leadingSlug(message: string): string | undefined {
  return /^"([a-z0-9][a-z0-9-]*)"/.exec(message)?.[1];
}

/** The exit code a thrown error ends the command with. */
export function exitCodeOfError(error: unknown): ExitCode {
  if (error instanceof ContractsError) return error.exitCode;
  const exit = exitCodeOf(diagnosticsOfError(error));
  return exit === 0 ? EXIT.refusal : exit;
}

/** A failure as the text printed to stderr: the message, then each distinct code with its remedy. */
export function renderErrorText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const seen = new Set<string>();
  const lines = [message];
  for (const item of diagnosticsOfError(error)) {
    if (seen.has(item.code)) continue;
    seen.add(item.code);
    lines.push(`  [${item.code}] ${item.remedy}`);
  }
  return lines.join("\n");
}

/** Warnings as text for stderr, one block each. */
export function renderWarningsText(diagnostics: readonly Diagnostic[]): string {
  return diagnostics
    .filter((item) => item.severity === "warning")
    .map(
      (item) =>
        `warning[${item.code}] ${item.path ? `${item.path}: ` : ""}${item.message}\n  ${item.remedy}`,
    )
    .join("\n");
}

export function renderJson(report: JsonReport): string {
  return JSON.stringify(report, null, 2);
}

export function failureReport(command: string | undefined, error: unknown): JsonReport {
  return {
    command,
    ok: false,
    exitCode: exitCodeOfError(error),
    diagnostics: diagnosticsOfError(error),
  };
}
