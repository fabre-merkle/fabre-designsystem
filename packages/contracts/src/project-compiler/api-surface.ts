/**
 * The compiler's public surface, as data, and the rule for comparing two of them.
 *
 * Scripts and agents match on the refusal codes, commands, flags and exit codes, so changing one
 * is a change to an API even when no contract changes (and therefore no contract hash does).
 * `compilerApiSurface()` lists them; a committed copy of it is compared with the base branch's.
 *
 * - Breaking: a code, command, argument, flag or exit code is removed or renamed, a code's
 *   severity or exit code changes, an exit code changes meaning, or an argument becomes required.
 *   A breaking change needs a new major base schema version.
 * - Additive: anything new. Not breaking, and needs no version change.
 */
import { DIAGNOSTICS } from "../generation-contract/diagnostics";
import { COMMANDS } from "./commands";
import { EXIT } from "./prerequisites";

export interface CompilerApiSurface {
  /** The base schema version this surface belongs to (the package manifest's). */
  baseSchemaVersion: string;
  exitCodes: Record<string, number>;
  diagnostics: Record<string, { severity: string; exit: number | null }>;
  commands: Record<
    string,
    { arguments: Array<{ name: string; required: boolean }>; flags: string[] }
  >;
}

export function compilerApiSurface(baseSchemaVersion: string): CompilerApiSurface {
  return {
    baseSchemaVersion,
    exitCodes: { ...EXIT },
    diagnostics: Object.fromEntries(
      Object.entries(DIAGNOSTICS).map(([code, definition]) => [
        code,
        {
          severity: definition.severity,
          exit: "exit" in definition ? (definition.exit ?? null) : null,
        },
      ]),
    ),
    commands: Object.fromEntries(
      COMMANDS.map((command) => [
        command.name,
        {
          arguments: command.arguments.map(({ name, required }) => ({ name, required })),
          flags: command.options.map((option) => option.flags),
        },
      ]),
    ),
  };
}

export interface ApiComparison {
  breaking: string[];
  additive: string[];
}

/** What changed from `base` to `head`, split into breaking and additive changes. */
export function compareApiSurfaces(
  base: CompilerApiSurface,
  head: CompilerApiSurface,
): ApiComparison {
  const breaking: string[] = [];
  const additive: string[] = [];

  for (const [name, code] of Object.entries(base.exitCodes)) {
    if (!(name in head.exitCodes)) breaking.push(`exit code "${name}" removed`);
    else if (head.exitCodes[name] !== code) {
      breaking.push(`exit code "${name}" changed from ${code} to ${head.exitCodes[name]}`);
    }
  }
  for (const name of Object.keys(head.exitCodes)) {
    if (!(name in base.exitCodes)) additive.push(`exit code "${name}" added`);
  }

  for (const [code, definition] of Object.entries(base.diagnostics)) {
    const next = head.diagnostics[code];
    if (!next) {
      breaking.push(`refusal or warning code "${code}" removed or renamed`);
    } else if (next.severity !== definition.severity || next.exit !== definition.exit) {
      breaking.push(
        `code "${code}" changed from ${definition.severity}/exit ${definition.exit} to ${next.severity}/exit ${next.exit}`,
      );
    }
  }
  for (const code of Object.keys(head.diagnostics)) {
    if (!(code in base.diagnostics)) additive.push(`code "${code}" added`);
  }

  for (const [name, command] of Object.entries(base.commands)) {
    const next = head.commands[name];
    if (!next) {
      breaking.push(`command "${name}" removed or renamed`);
      continue;
    }
    for (const flag of command.flags) {
      if (!next.flags.includes(flag))
        breaking.push(`command "${name}" flag "${flag}" removed or renamed`);
    }
    for (const flag of next.flags) {
      if (!command.flags.includes(flag)) additive.push(`command "${name}" flag "${flag}" added`);
    }
    for (const [index, argument] of command.arguments.entries()) {
      const after = next.arguments[index];
      if (!after || after.name !== argument.name) {
        breaking.push(`command "${name}" argument "${argument.name}" removed or renamed`);
      } else if (after.required && !argument.required) {
        breaking.push(`command "${name}" argument "${argument.name}" became required`);
      }
    }
    for (const argument of next.arguments.slice(command.arguments.length)) {
      (argument.required ? breaking : additive).push(
        `command "${name}" argument "${argument.name}" added${argument.required ? " as required" : ""}`,
      );
    }
  }
  for (const name of Object.keys(head.commands)) {
    if (!(name in base.commands)) additive.push(`command "${name}" added`);
  }
  return { breaking, additive };
}

/**
 * What is wrong with the head's API snapshot given the base's. A base snapshot with no head
 * snapshot is a failure (the snapshot was deleted), and a breaking change needs a new major
 * base schema version.
 */
export function apiSnapshotProblems(
  base: CompilerApiSurface,
  head: CompilerApiSurface | undefined,
): string[] {
  if (!head) {
    return [
      "The base has a compiler API snapshot but this branch does not. Restore compiler-api.snapshot.json.",
    ];
  }
  const { breaking } = compareApiSurfaces(base, head);
  const major = (version: string) => Number(version.split(".")[0]);
  if (breaking.length > 0 && major(head.baseSchemaVersion) <= major(base.baseSchemaVersion)) {
    return [
      `The compiler API changed in a breaking way without a new major base schema version ` +
        `(still ${head.baseSchemaVersion}): ${breaking.join("; ")}.`,
    ];
  }
  return [];
}
