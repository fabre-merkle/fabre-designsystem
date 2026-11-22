/**
 * The command definitions: the one place that says what the compiler's commands are called, what
 * arguments and flags they take, what each exit code means and which examples to show.
 *
 * Everything that talks about the commands reads this module: the `--help` text is built from it
 * (see `program.ts`), and a test runs every example below against a sample project and checks the
 * exit code it documents. To rename a command or add a flag, change it here; the parser wiring
 * and the handlers follow.
 *
 * This file is plain data. It imports nothing but the exit codes, so it is safe to read from
 * anywhere (documentation generators included) without loading the parser.
 */
import { EXIT, type ExitCode } from "./prerequisites";

export interface ArgumentDefinition {
  name: string;
  description: string;
  required: boolean;
}

export interface OptionDefinition {
  /** The flag as written in help, e.g. `--root <dir>`. */
  flags: string;
  /** The key the handler receives the value under. */
  key: "root" | "force" | "json" | "yes";
  description: string;
}

/** The project state an example assumes. The example test builds one sample project per name. */
export type ExampleScenario =
  /** A project with the compiler and a contract, nothing compiled yet. */
  | "ready"
  /** The same project after `compile`: the artifact is current. */
  | "compiled"
  /** The artifact exists but no longer matches the contracts. */
  | "stale"
  /** A component with source and a stylesheet but no contract file. */
  | "uncontracted"
  /** A directory that is not a workspace root. */
  | "no-workspace";

export interface ExampleDefinition {
  /** The arguments after the program name, exactly as typed. */
  command: string;
  description: string;
  /** The exit code this example must produce. */
  exit: ExitCode;
  scenario: ExampleScenario;
}

export interface CommandDefinition {
  name: CommandName;
  /** One line, shown in the command list. */
  summary: string;
  /** Longer text shown by `<command> --help`. */
  description: string;
  arguments: ArgumentDefinition[];
  options: OptionDefinition[];
  examples: ExampleDefinition[];
}

export type CommandName = "compile" | "check" | "validate" | "list" | "explain" | "new";

/** What every exit code means, for every command. */
export const EXIT_CODES: ReadonlyArray<{ code: ExitCode; meaning: string }> = [
  { code: EXIT.ok, meaning: "Success." },
  { code: EXIT.refusal, meaning: "A contract was refused, or the committed artifact is stale." },
  { code: EXIT.usage, meaning: "Usage error: an unknown command, flag or slug." },
  { code: EXIT.missingPrerequisite, meaning: "A prerequisite is missing; the message names it." },
];

const ROOT: OptionDefinition = {
  flags: "--root <dir>",
  key: "root",
  description: "The workspace root, instead of searching upward from the current directory.",
};

const JSON_OUTPUT: OptionDefinition = {
  flags: "--json",
  key: "json",
  description:
    "Print one JSON document (code, severity, path, message and remedy for every diagnostic) " +
    "instead of text. Never prompts.",
};

const SLUG = (description: string, required = true): ArgumentDefinition => ({
  name: "slug",
  description,
  required,
});

export const PROGRAM_NAME = "contracts";

export const PROGRAM_DESCRIPTION =
  "Validate the co-located *.figma.contract.ts files and compile them into " +
  ".agents/figma-generation-contract.json and the component catalogue .agents/component-catalogue.json.";

export const COMMANDS: readonly CommandDefinition[] = [
  {
    name: "compile",
    summary: "Compile every contract into the artifact and the component catalogue",
    description:
      "Validates every contract against the schema, pairs it with its component source and " +
      "stylesheet, and writes the artifact (.agents/figma-generation-contract.json) and the " +
      "component catalogue (.agents/component-catalogue.json), which merges in the optional " +
      ".agents/component-guidance.json. Commit both.",
    arguments: [],
    options: [ROOT, JSON_OUTPUT],
    examples: [
      {
        command: "compile",
        description: "Write the artifact and the catalogue.",
        exit: EXIT.ok,
        scenario: "ready",
      },
      {
        command: "compile",
        description: "Outside a workspace root there is nothing to compile.",
        exit: EXIT.missingPrerequisite,
        scenario: "no-workspace",
      },
    ],
  },
  {
    name: "check",
    summary: "Fail when the committed artifact or catalogue is stale",
    description:
      "Compiles in memory and compares the result with the committed artifact and catalogue. " +
      "Writes nothing. " +
      "Run it in CI. With --json it prints every diagnostic as data.",
    arguments: [],
    options: [ROOT, JSON_OUTPUT],
    examples: [
      {
        command: "check",
        description: "Pass when the committed artifact and catalogue match the contracts.",
        exit: EXIT.ok,
        scenario: "compiled",
      },
      {
        command: "check",
        description: "Fail when a contract or its component changed since the last compile.",
        exit: EXIT.refusal,
        scenario: "stale",
      },
      {
        command: "check --json",
        description: "Print every diagnostic as JSON: code, severity, path, message and remedy.",
        exit: EXIT.refusal,
        scenario: "stale",
      },
    ],
  },
  {
    name: "validate",
    summary: "Check one contract against the schema and the compiler",
    description:
      "Runs the schema check and the full compile for one contract (and any contract it " +
      "composes), without writing anything. Exits 1 and names the problem when it is refused.",
    arguments: [SLUG("The component directory name, e.g. toggle-group.")],
    options: [ROOT, JSON_OUTPUT],
    examples: [
      {
        command: "validate button",
        description: "Check the button contract.",
        exit: EXIT.ok,
        scenario: "ready",
      },
      {
        command: "validate no-such-component",
        description: "A slug with no contract is a usage error.",
        exit: EXIT.usage,
        scenario: "ready",
      },
    ],
  },
  {
    name: "list",
    summary: "List the contracts in the project",
    description:
      "Lists every component folder that holds a contract, with its axes and examples. Reads " +
      "the contracts without validating them, so it works on a contract that is still broken.",
    arguments: [],
    options: [ROOT, JSON_OUTPUT],
    examples: [
      {
        command: "list",
        description: "Show every contract.",
        exit: EXIT.ok,
        scenario: "ready",
      },
    ],
  },
  {
    name: "explain",
    summary: "Describe one contract: parts, axes, slots and where each axis comes from",
    description:
      "Prints a contract in plain text next to what the component source declares, marking each " +
      "axis as read from source, curated, or design-only. With --json it prints the same report " +
      "as data. Without a slug, an interactive terminal offers a list; anywhere else the slug is required.",
    arguments: [SLUG("The component directory name, e.g. toggle-group.", false)],
    options: [ROOT, JSON_OUTPUT],
    examples: [
      {
        command: "explain button",
        description: "Describe the button contract.",
        exit: EXIT.ok,
        scenario: "ready",
      },
      {
        command: "explain button --json",
        description: "Print the report as JSON.",
        exit: EXIT.ok,
        scenario: "ready",
      },
      {
        command: "explain no-such-component",
        description: "A slug with no contract is a usage error.",
        exit: EXIT.usage,
        scenario: "ready",
      },
      {
        command: "explain",
        description: "Without a slug and without a terminal, the slug is required.",
        exit: EXIT.usage,
        scenario: "ready",
      },
    ],
  },
  {
    name: "new",
    summary: "Write a starter contract pre-filled from the component's code",
    description:
      "Reads the component's source and stylesheet and writes <slug>.figma.contract.ts beside " +
      "them with the parts, axes and one example per axis value taken from the code, so you " +
      "add only what the code cannot say. Refuses to overwrite a contract unless --force (or " +
      "--yes); an interactive terminal asks first. Without a slug, an interactive terminal " +
      "offers a list; anywhere else the slug is required.",
    arguments: [SLUG("The component directory name, e.g. toggle-group.", false)],
    options: [
      ROOT,
      JSON_OUTPUT,
      {
        flags: "--force",
        key: "force",
        description: "Overwrite an existing contract file.",
      },
      {
        flags: "--yes",
        key: "yes",
        description:
          "Answer yes to every question (replace an existing contract) and never prompt.",
      },
    ],
    examples: [
      {
        command: "new button",
        description: "Write a starter contract for a component that has none.",
        exit: EXIT.ok,
        scenario: "uncontracted",
      },
      {
        command: "new button",
        description: "A component that already has a contract is refused.",
        exit: EXIT.refusal,
        scenario: "ready",
      },
      {
        command: "new",
        description: "Without a slug and without a terminal, the slug is required.",
        exit: EXIT.usage,
        scenario: "uncontracted",
      },
      {
        command: "new button --yes",
        description: "Replace the existing contract without asking.",
        exit: EXIT.ok,
        scenario: "ready",
      },
      {
        command: "new button --force",
        description: "Replace the existing contract with a fresh starter.",
        exit: EXIT.ok,
        scenario: "ready",
      },
    ],
  },
];

export function findCommand(name: string): CommandDefinition | undefined {
  return COMMANDS.find((command) => command.name === name);
}

/** Every documented example, flattened, for tests and generated documentation. */
export function allExamples(): Array<ExampleDefinition & { commandName: CommandName }> {
  return COMMANDS.flatMap((command) =>
    command.examples.map((example) => ({ ...example, commandName: command.name })),
  );
}
