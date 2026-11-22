/**
 * The compiler's diagnostics: every refusal and warning it can report, defined once.
 *
 * Each code has a severity, a one-line message saying what the code means, a remedy saying what to
 * do about it, and (for errors) the exit code the command line ends with. The command line prints
 * these as text or as JSON, `--help` lists them, the generated reference pages render them, and a
 * test fires every one, so a code cannot be added without a message and a remedy, or documented
 * without being reachable.
 *
 * Codes are stable names that scripts and agents match on. Renaming or removing one is a breaking
 * change. Adding one is not.
 *
 * Dependency-free: this module ships inside the installed compiler.
 */

export type DiagnosticSeverity = "error" | "warning";

/** Exit codes an error can end the command line with. Warnings never change the exit code. */
export type DiagnosticExit = 1 | 2 | 3;

export interface DiagnosticDefinition {
  severity: DiagnosticSeverity;
  /** What the code means, in one sentence. Each report adds its own specific message. */
  message: string;
  /** What to do about it. */
  remedy: string;
  /** The exit code of an error with this code: 1 refusal, 2 usage, 3 missing prerequisite. */
  exit?: DiagnosticExit;
}

const error = (exit: DiagnosticExit, message: string, remedy: string): DiagnosticDefinition => ({
  severity: "error",
  exit,
  message,
  remedy,
});

const warning = (message: string, remedy: string): DiagnosticDefinition => ({
  severity: "warning",
  message,
  remedy,
});

export const DIAGNOSTICS = {
  // Exit 1: a contract was refused, or the artifact is stale.
  "schema-invalid": error(
    1,
    "A contract does not match the contract schema.",
    "Fix the fields named in the path. `contracts explain <slug>` shows what the component source declares.",
  ),
  "unknown-axis": error(
    1,
    "A contract names an axis the component does not declare.",
    "Use an axis from the component's props, or add the prop to the component source.",
  ),
  "unknown-axis-value": error(
    1,
    "A contract names a value that its axis does not have.",
    "Use one of the axis values the component declares, or add the value to the component source.",
  ),
  "axis-default-missing": error(
    1,
    "A component does not state a default for an axis the compiler reads from its source.",
    'Declare the default in the component\'s own parameters, for example `size = "md"`, or assign a nullish chain that ends in a literal.',
  ),
  "slug-mismatch": error(
    1,
    "A contract's slug differs from the name of its component folder.",
    "Rename the folder or change `slug` so both are the same.",
  ),
  "contract-file-invalid": error(
    1,
    "A contract file does not export exactly one current contract.",
    "Export one `defineFigmaContract({ ... })` object from the file.",
  ),
  "component-files-missing": error(
    1,
    "A contract has no component source or stylesheet beside it.",
    "Add `<slug>.tsx` and `<slug>.css` in the contract's folder.",
  ),
  "composition-invalid": error(
    1,
    "A contract composes a component that does not exist, uses a variant it does not have, or forms a cycle.",
    "Point the slot at a contracted component, use one of its axis values, and break any cycle.",
  ),
  "focus-ring-invalid": error(
    1,
    "A declared `focusRing` cannot be generated from the stylesheet.",
    "Give the root a `:focus-visible` rule with an outline width and offset that are each a single token and an outline colour for every variant, or remove `focusRing` from the contract.",
  ),
  "pseudo-part-refused": error(
    1,
    "A declared pseudo-element part cannot be represented in Figma.",
    "Remove the part from `parts` and the anatomy, or change the stylesheet to a shape the compiler resolves.",
  ),
  "size-underdetermined": error(
    1,
    "A part states a width or height that the compiler could not resolve to a number, a variable or a fill.",
    "Make sure the token folder holds every token the stylesheet references, or declare the part's size in figma-layout.config.ts.",
  ),
  "css-unsupported": error(
    1,
    "A stylesheet uses CSS the compiler cannot map to the design without guessing its meaning.",
    "Rewrite the rule the message names: use `@layer`, `@media` and `@keyframes` blocks, rules and native nesting. `@container`, `@supports`, `@import` and other at-rules, declarations outside a rule, and a nested selector that cannot be joined to its parent exactly are refused.",
  ),
  "contract-exists": error(
    1,
    "A contract file already exists where `new` would write one.",
    "Edit the existing contract, or pass `--force` (or `--yes`) to replace it.",
  ),
  "artifact-stale": error(
    1,
    "The committed artifact no longer matches the contracts and their components.",
    "Run `compile` and commit the artifact.",
  ),
  "catalogue-stale": error(
    1,
    "The committed component catalogue no longer matches the contracts and the guidance file.",
    "Run `compile` and commit the catalogue.",
  ),
  "guidance-invalid": error(
    1,
    "The component guidance file is not valid JSON or does not match its format.",
    "Fix the fields named in the path. The guidance format is on the catalogue reference page.",
  ),
  "guidance-unknown-component": error(
    1,
    "The component guidance file names a component that has no contract.",
    "Use the slug of a contracted component, or remove the entry or link.",
  ),
  "contract-refused": error(
    1,
    "The compiler refused a contract for a reason without a dedicated code.",
    "Read the message: it names the contract and the rule it broke.",
  ),

  // Exit 2: usage.
  "usage-invalid": error(
    2,
    "The command line is not valid: an unknown command or flag, or a missing argument.",
    "Run the command with `--help` to see its arguments and flags.",
  ),
  "slug-required": error(
    2,
    "The command needs a component slug.",
    "Pass the component's folder name, for example `toggle-group`. In an interactive terminal, leave it out to choose from a list.",
  ),
  "slug-invalid": error(
    2,
    "The argument is not a component slug.",
    "Use the component's folder name: lowercase letters, digits and hyphens.",
  ),
  "contract-unknown": error(
    2,
    "No contract exists for the slug.",
    "Run `list` to see the contracts in the project, or `new <slug>` to write one.",
  ),
  "component-unknown": error(
    2,
    "No component exists for the slug.",
    "Check the slug against the component folders, or add the component first.",
  ),

  // Exit 3: a prerequisite is missing.
  "bun-missing": error(
    3,
    "The compiler is running without Bun.",
    "Install Bun (https://bun.sh) and run the command again.",
  ),
  "workspace-root-missing": error(
    3,
    "No workspace root with a packages/* workspace was found.",
    'Run the command from inside the project, pass `--root <dir>`, or add `"workspaces": ["packages/*"]` to the root package.json.',
  ),
  "dependency-missing": error(
    3,
    "A runtime dependency of the compiler is not installed.",
    "Run `bun install` at the workspace root.",
  ),
  "no-contracts": error(
    3,
    "No contract files were found under the component directory.",
    "Install a component that ships a contract, or point `aliases.ui` in components.json or `componentsDir` in contracts.config.ts at the directory that holds them.",
  ),
  "tokens-missing": error(
    3,
    "The folder of raw DTCG token sets is missing or empty.",
    "Pull the raw tokens from your Tokens Studio project, or point `tokensDir` in contracts.config.ts at the folder that holds them.",
  ),

  // Warnings: reported, never fail the command.
  "schema-deviated": warning(
    "The project's contract schema no longer matches the base it was installed from.",
    "Expected when you edited the schema on purpose. Generate with the skill flow rather than the Figma plugin, and merge schema updates by hand.",
  ),
  "descendant-override": warning(
    "A parent's stylesheet restyles a composed child in a way Figma cannot override on the instance.",
    "Move the declaration into the child's own stylesheet, or accept that the instance keeps the child's own value.",
  ),
  "selector-skipped": warning(
    "A stylesheet rule aimed at a modelled part uses a selector the compiler does not evaluate, so its bindings never reach a variant cell.",
    "Rewrite the rule with attribute selectors, `:is()`, `:where()` and `:not()` over attributes, and a descendant or child combinator, or accept that the design keeps the value the other rules give. Browsers still apply the rule; Figma does not.",
  ),
  "focus-ring-dropped": warning(
    "The root has a `:focus-visible` outline that no State value and no `focusRing` declaration covers, so the generated component has no ring.",
    "Declare `focusRing` on the contract to generate the ring as a layer, or add a State value whose selector is `:focus-visible`.",
  ),
  "variant-cap-exceeded": warning(
    "A component set holds more variants than the 30 Figma's library guidance allows, and the contract gives no reason for it.",
    "Split the contract into one set per value of a primary axis with `split`, move what is not a visual difference into component properties, or move a sub-element with its own states into a Building Block. If the set has to stay whole, state why in `capReason`.",
  ),
} as const satisfies Record<string, DiagnosticDefinition>;

export type DiagnosticCode = keyof typeof DIAGNOSTICS;

export const DIAGNOSTIC_CODES = Object.keys(DIAGNOSTICS) as DiagnosticCode[];

/** Every code with its severity, exit code, message and remedy, in definition order. */
export function diagnosticReference(): Array<{
  code: DiagnosticCode;
  severity: DiagnosticSeverity;
  exit: DiagnosticExit | undefined;
  message: string;
  remedy: string;
}> {
  return DIAGNOSTIC_CODES.map((code) => {
    const definition: DiagnosticDefinition = DIAGNOSTICS[code];
    return {
      code,
      severity: definition.severity,
      exit: definition.exit,
      message: definition.message,
      remedy: definition.remedy,
    };
  });
}

/** One reported problem. */
export interface Diagnostic {
  code: DiagnosticCode;
  severity: DiagnosticSeverity;
  /** The contract slug plus a JSON pointer, `toggle-group#/slots/0`; a file path or empty when no contract applies. */
  path: string;
  /** What is wrong here, specifically. */
  message: string;
  /** What to do about it. */
  remedy: string;
}

export function diagnostic(code: DiagnosticCode, message: string, path = ""): Diagnostic {
  const definition: DiagnosticDefinition = DIAGNOSTICS[code];
  return { code, severity: definition.severity, path, message, remedy: definition.remedy };
}

/** `slug#/a/0/b` from a contract slug and the path segments of the offending value. */
export function diagnosticPath(slug: string, segments: readonly (string | number)[] = []): string {
  if (segments.length === 0) return slug;
  const pointer = segments.map((s) => String(s).replace(/~/g, "~0").replace(/\//g, "~1")).join("/");
  return `${slug}#/${pointer}`;
}

/** The exit code a set of diagnostics ends the command with: the highest of its errors, 0 for none. */
export function exitCodeOf(diagnostics: readonly Diagnostic[]): 0 | DiagnosticExit {
  let exit: 0 | DiagnosticExit = 0;
  for (const item of diagnostics) {
    if (item.severity !== "error") continue;
    const own: DiagnosticDefinition = DIAGNOSTICS[item.code];
    exit = Math.max(exit, own.exit ?? 1) as DiagnosticExit;
  }
  return exit;
}

/** A refusal raised inside the compiler. It carries its diagnostics; its message is the readable text. */
export class RefusalError extends Error {
  readonly diagnostics: Diagnostic[];

  constructor(message: string, diagnostics: Diagnostic[]) {
    super(message);
    this.name = "RefusalError";
    this.diagnostics = diagnostics;
  }
}

/** A refusal with one diagnostic: the code, the message and the path of the offending value. */
export function refusal(code: DiagnosticCode, message: string, path = ""): RefusalError {
  return new RefusalError(message, [diagnostic(code, message, path)]);
}

/** One line per diagnostic, with its remedy underneath. */
export function renderDiagnosticText(item: Diagnostic): string {
  const where = item.path ? ` ${item.path}:` : "";
  return `${item.severity}[${item.code}]${where} ${item.message}\n  Remedy: ${item.remedy}`;
}

/** The `size-underdetermined` diagnostic for one part whose width or height could not be resolved. */
export function sizeUnderdeterminedDiagnostic(finding: {
  component: string;
  part: string;
  property: string;
  value: string;
}): Diagnostic {
  return diagnostic(
    "size-underdetermined",
    `${finding.component}: part "${finding.part}" ${finding.property} is unresolved (${finding.value}).`,
    diagnosticPath(finding.component, ["parts", finding.part, finding.property]),
  );
}
