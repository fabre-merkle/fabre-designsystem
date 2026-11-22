/**
 * What each command does.
 *
 * A handler takes plain values (the command's arguments and flags) and returns a result: an exit
 * code, the text for each stream, and the structured data the text was made from. It prints
 * nothing and imports nothing from the command-line parser, so swapping the parser touches only
 * `program.ts`, and a new output format only needs to render `data` instead of `out`.
 *
 * A handler throws for anything that is not a normal outcome. `ContractsError` carries its own
 * exit code; any other error is a refusal (exit 1). `cli.ts` turns the throw into stderr text.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import {
  type AuthoredGenerationContract,
  buildGenerationContractArtifact,
  type CompileGenerationContractInput,
  normalizeContractAxes,
} from "../generation-contract";
import type { Diagnostic } from "../generation-contract/diagnostics";
import { extractComponentRegistry } from "../registry/extract-registry";
import type { CommandName } from "./commands";
import {
  artifactWarnings,
  buildArtifact,
  check,
  compile,
  importContract,
  loadInput,
  loadProject,
  type Project,
  selectorWarnings,
  withProjectTokens,
} from "./compile";
import { componentDirectories } from "./discovery";
import {
  ContractsError,
  EXIT,
  type ExitCode,
  findWorkspaceRoot,
  UsageError,
} from "./prerequisites";
import { canPrompt, createTerminalPrompter, type Prompter } from "./prompts";
import { assertPartsSized } from "./size-gate";
import { renderStarterContract } from "./starter";

/** The values a command received, already parsed. */
export interface CommandInput {
  /** The slug argument of `validate`, `explain` and `new`. */
  slug?: string;
  options: {
    root?: string;
    force?: boolean;
    /** Print JSON instead of text, and never prompt. */
    json?: boolean;
    /** Answer yes to every question, and never prompt. */
    yes?: boolean;
  };
}

/** Where the command runs. */
export interface CommandEnvironment {
  cwd: string;
  /** The installed package directory (holds the config, the layout manifest and the manifest). */
  packageDir: string;
  /** Whether stdin and stdout are a terminal. Prompts need it; everything else ignores it. */
  interactive?: boolean;
  /** Asks questions. Defaults to the terminal; tests pass their own. */
  prompter?: Prompter;
}

export interface CommandResult<Data = unknown> {
  exitCode: ExitCode;
  /** Text for stdout. */
  out: string;
  /** Text for stderr. */
  err: string;
  /** The structure `out` was rendered from. */
  data: Data;
  /** Warnings (and any refusal that is not thrown), each with a stable code and a remedy. */
  diagnostics: Diagnostic[];
}

export interface ListEntry {
  slug: string;
  componentName?: string;
  axes?: number;
  examples?: number;
  /** How many component sets the contract generates. Absent when the project does not compile. */
  sets?: number;
  /** The most variants any of those sets holds (the cap is 30). Absent when the project does not compile. */
  variants?: number;
  /** `sha256:<hex>` of the normalized contract. Absent when the project does not compile. */
  hash?: string;
  /** Set when the contract file could not be read. */
  unreadable?: string;
}

export interface ExplainAxis {
  prop: string;
  values: string[];
  default: string;
  /** Where the axis comes from: the component source, a curated version of it, or the design only. */
  origin: "source" | "curated" | "design-only";
}

export interface ExplainReport {
  slug: string;
  componentName: string;
  componentPath: string;
  stylesheetPath: string;
  rootPart: string;
  parts: string[];
  axes: ExplainAxis[];
  /** Axes the source declares that the contract does not. */
  sourceOnlyAxes: Array<{ prop: string; values: string[] }>;
  slots: Array<{ name: string; part: string; required: boolean; composes?: string }>;
  examples: number;
  omittedParts: string[];
  /** The axis the contract splits into one set per value, when it splits. */
  split?: string | string[];
  /** The parts generated as hidden Building Block sets, when there are any. */
  buildingBlocks?: string[];
  /** The contract's written reason to exceed the 30-variant cap, when it gives one. */
  capReason?: string;
}

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/** Returns a valid component slug or throws a usage error saying what is wrong. */
function requireSlug(slug: string | undefined, command: CommandName): string {
  if (slug === undefined)
    throw new UsageError(`${command} needs a component slug.`, "slug-required");
  if (!SLUG_PATTERN.test(slug)) {
    throw new UsageError(
      `"${slug}" is not a component slug. Use the component directory name, e.g. toggle-group.`,
      "slug-invalid",
    );
  }
  return slug;
}

/** Whether a question may be asked for this command, here and now. */
function mayPrompt(input: CommandInput, env: CommandEnvironment): boolean {
  return canPrompt({
    interactive: env.interactive === true,
    json: input.options.json,
    yes: input.options.yes,
  });
}

/**
 * The slug of `command`: the argument when given, otherwise one chosen from `candidates` in an
 * interactive terminal. Anywhere a question cannot be asked, a missing slug is a usage error that
 * names the argument.
 */
async function slugOrChoose(
  input: CommandInput,
  env: CommandEnvironment,
  command: CommandName,
  candidates: readonly string[],
  message: string,
): Promise<string> {
  if (input.slug !== undefined) return requireSlug(input.slug, command);
  if (!mayPrompt(input, env)) return requireSlug(undefined, command);
  if (candidates.length === 0) {
    throw new UsageError(`${command} has no component to choose from.`, "component-unknown");
  }
  const chosen = await (env.prompter ?? createTerminalPrompter()).chooseComponent(
    candidates,
    message,
  );
  return requireSlug(chosen, command);
}

/** Builds a successful command result. */
function ok(out: string, data: unknown = undefined, diagnostics: Diagnostic[] = []): CommandResult {
  return { exitCode: EXIT.ok, out, err: "", data, diagnostics };
}

/** A one-line list of the project's contract slugs for error messages. */
function knownSlugs(project: Project): string {
  const slugs = project.entries.map((entry) => entry.slug);
  return slugs.length ? `Contracts: ${slugs.join(", ")}.` : "The project has no contracts yet.";
}

/**
 * Finds a project's contract entry by slug, throwing a usage error that lists the known slugs when
 * absent.
 */
function findEntry(project: Project, slug: string) {
  const entry = project.entries.find((candidate) => candidate.slug === slug);
  if (!entry) {
    throw new UsageError(
      `No contract for "${slug}" under ${relative(project.root, project.components.dir) || "."}. ${knownSlugs(project)}`,
      "contract-unknown",
    );
  }
  return entry;
}

/** Compiles the project's contracts and writes the artifact. */
async function runCompile(input: CommandInput, env: CommandEnvironment): Promise<CommandResult> {
  const root = findWorkspaceRoot(env.cwd, input.options.root);
  const outcome = await compile({ root, packageDir: env.packageDir });
  return ok(outcome.message, outcome, outcome.diagnostics);
}

/** Checks the written artifact is up to date with the contracts, failing when it is stale. */
async function runCheck(input: CommandInput, env: CommandEnvironment): Promise<CommandResult> {
  const root = findWorkspaceRoot(env.cwd, input.options.root);
  const outcome = await check({ root, packageDir: env.packageDir });
  return outcome.upToDate
    ? ok(outcome.message, outcome, outcome.diagnostics)
    : {
        exitCode: EXIT.refusal,
        out: "",
        err: outcome.message,
        data: outcome,
        diagnostics: outcome.diagnostics,
      };
}

/** The slugs `contract` composes, from its slots. */
function composedSlugs(contract: AuthoredGenerationContract): string[] {
  return (contract.slots ?? []).flatMap((slot) =>
    slot.composedChild ? [slot.composedChild.component] : [],
  );
}

/** Validates one contract against its component source without writing anything. */
async function runValidate(input: CommandInput, env: CommandEnvironment): Promise<CommandResult> {
  const slug = requireSlug(input.slug, "validate");
  const root = findWorkspaceRoot(env.cwd, input.options.root);
  const project = await loadProject({ root, packageDir: env.packageDir });
  findEntry(project, slug);

  // A contract is checked together with every contract it composes, because composed-child
  // references and keys are properties of the set. Nothing else is loaded, so another
  // component's mistake never hides this one's.
  const inputs: CompileGenerationContractInput[] = [];
  const queue = [slug];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const next = queue.shift() as string;
    if (seen.has(next)) continue;
    seen.add(next);
    const entry = project.entries.find((candidate) => candidate.slug === next);
    if (!entry) continue;
    const loaded = await loadInput(project, entry);
    inputs.push(loaded);
    queue.push(...composedSlugs(loaded.contract));
  }
  const artifact = withProjectTokens(project, () => {
    const built = buildGenerationContractArtifact(inputs, project.config.documentationPage);
    assertPartsSized(built.components);
    return built;
  });

  const checked = inputs.map((loaded) => loaded.contract.slug);
  const extra = checked.length > 1 ? ` (checked with ${checked.slice(1).join(", ")})` : "";
  return ok(`Contract "${slug}" is valid${extra}.`, { slug, checked }, [
    ...artifactWarnings(env.packageDir, artifact.components),
    ...selectorWarnings(inputs),
  ]);
}

/** Right-pads a string to a column width. */
function pad(value: string, width: number): string {
  return value.length >= width ? value : value + " ".repeat(width - value.length);
}

/**
 * How many axes the component has once the compiler fills in the ones its source declares. A
 * contract lists only its exceptions, so counting `contract.axes` alone would undercount. Falls
 * back to the authored count when the source cannot be read.
 */
async function resolvedAxisCount(
  project: Awaited<ReturnType<typeof loadProject>>,
  entry: Parameters<typeof loadInput>[1],
  contract: { axes?: readonly unknown[] },
): Promise<number> {
  try {
    const loaded = await loadInput(project, entry);
    const fromSource = extractComponentRegistry({
      name: loaded.contract.componentName,
      tsxSource: loaded.tsxSource,
      sourcePath: loaded.sourcePath,
      cssSource: loaded.cssSource,
      componentPath: loaded.componentPath,
      stylesheetPath: loaded.stylesheetPath,
      rootPart: loaded.contract.rootPart,
    }).axes;
    return normalizeContractAxes(loaded.contract, fromSource).axes.length;
  } catch {
    return contract.axes?.length ?? 0;
  }
}

/**
 * Lists the project's contracts with their component, axis and example counts and content hash;
 * unreadable contracts are marked as such.
 */
async function runList(input: CommandInput, env: CommandEnvironment): Promise<CommandResult> {
  const root = findWorkspaceRoot(env.cwd, input.options.root);
  const project = await loadProject({ root, packageDir: env.packageDir });
  const location = relative(root, project.components.dir) || ".";
  const entries: ListEntry[] = [];
  // The hash is of the normalized contract, so it needs a full compile. A project that does not
  // compile (a refused contract, no tokens) still lists its contracts, just without hashes.
  const built = await buildArtifact({ root, packageDir: env.packageDir }).then(
    (result) => result,
    () => undefined,
  );
  const hashes: Record<string, string> = built?.hashes ?? {};
  const setsOf = (slug: string) => (built?.sets ?? []).filter((set) => set.slug === slug);
  for (const entry of project.entries) {
    try {
      const contract = await importContract(entry.contractPath, root);
      entries.push({
        slug: entry.slug,
        componentName: contract.componentName,
        axes: await resolvedAxisCount(project, entry, contract),
        examples: contract.documentation?.examples?.length ?? 0,
        ...(built
          ? {
              sets: setsOf(entry.slug).length,
              variants: Math.max(0, ...setsOf(entry.slug).map((set) => set.variants)),
            }
          : {}),
        ...(hashes[entry.slug] ? { hash: hashes[entry.slug] } : {}),
      });
    } catch (error) {
      entries.push({
        slug: entry.slug,
        unreadable: error instanceof Error ? error.message : String(error),
      });
    }
  }
  if (entries.length === 0) {
    return ok(`No *.figma.contract.ts found under ${location}.`, entries);
  }
  const width = Math.max(...entries.map((entry) => entry.slug.length), "SLUG".length);
  const nameWidth = Math.max(...entries.map((entry) => (entry.componentName ?? "").length), 9);
  const lines = [
    `${pad("SLUG", width)}  ${pad("COMPONENT", nameWidth)}  AXES  EXAMPLES  SETS  VARIANTS  HASH`,
  ];
  for (const entry of entries) {
    lines.push(
      entry.unreadable === undefined
        ? `${pad(entry.slug, width)}  ${pad(entry.componentName ?? "", nameWidth)}  ${pad(String(entry.axes), 4)}  ${pad(String(entry.examples), 8)}  ${pad(String(entry.sets ?? "-"), 4)}  ${pad(String(entry.variants ?? "-"), 8)}  ${entry.hash ?? "-"}`
        : `${pad(entry.slug, width)}  unreadable: ${entry.unreadable.split("\n")[0]}`,
    );
  }
  lines.push("", `${entries.length} contract${entries.length === 1 ? "" : "s"} under ${location}.`);
  return ok(lines.join("\n"), entries);
}

/** Whether two string lists are equal in order and content. */
function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** Explains how one contract resolves, choosing a component interactively when no slug is given. */
async function runExplain(input: CommandInput, env: CommandEnvironment): Promise<CommandResult> {
  const root = findWorkspaceRoot(env.cwd, input.options.root);
  const project = await loadProject({ root, packageDir: env.packageDir });
  const slug = await slugOrChoose(
    input,
    env,
    "explain",
    project.entries.map((entry) => entry.slug),
    "Which contract do you want explained?",
  );
  const loaded = await loadInput(project, findEntry(project, slug));
  const { contract } = loaded;
  const fromSource = extractComponentRegistry({
    name: contract.componentName,
    tsxSource: loaded.tsxSource,
    sourcePath: loaded.sourcePath,
    cssSource: loaded.cssSource,
    componentPath: loaded.componentPath,
    stylesheetPath: loaded.stylesheetPath,
    rootPart: contract.rootPart,
  }).axes;

  // Explain the resolved axes: a source-derived axis is filled in by the compiler, so an
  // authored contract may omit `axes` entirely.
  const resolvedAxes = normalizeContractAxes(contract, fromSource).axes;
  const axes: ExplainAxis[] = resolvedAxes.map((axis) => {
    const declared = fromSource.find((candidate) => candidate.prop === axis.prop);
    const origin: ExplainAxis["origin"] = !declared
      ? "design-only"
      : sameList(declared.values, axis.values) && declared.default === axis.default
        ? "source"
        : "curated";
    return { prop: axis.prop, values: axis.values, default: axis.default, origin };
  });
  const report: ExplainReport = {
    slug,
    componentName: contract.componentName,
    componentPath: loaded.componentPath,
    stylesheetPath: loaded.stylesheetPath,
    rootPart: contract.rootPart,
    parts: contract.parts,
    axes,
    sourceOnlyAxes: fromSource
      .filter((candidate) => !resolvedAxes.some((axis) => axis.prop === candidate.prop))
      .map((candidate) => ({ prop: candidate.prop, values: candidate.values })),
    slots: (contract.slots ?? []).map((slot) => ({
      name: slot.name,
      part: slot.part,
      required: slot.required === true,
      ...(slot.composedChild ? { composes: slot.composedChild.component } : {}),
    })),
    examples: contract.documentation.examples.length,
    omittedParts: Object.keys(contract.omittedParts ?? {}),
    ...(contract.split ? { split: contract.split.axis } : {}),
    ...(contract.buildingBlocks?.length
      ? { buildingBlocks: contract.buildingBlocks.map((block) => block.part) }
      : {}),
    ...(contract.capReason ? { capReason: contract.capReason } : {}),
  };

  const lines = [
    `${report.slug} (${report.componentName})`,
    `Source:     ${report.componentPath}`,
    `Stylesheet: ${report.stylesheetPath}`,
    `Root part:  ${report.rootPart}`,
    `Parts:      ${report.parts.join(", ") || "none"}`,
    "",
    "Axes",
  ];
  const propWidth = Math.max(...axes.map((axis) => axis.prop.length), 0);
  for (const axis of axes) {
    lines.push(
      `  ${pad(axis.prop, propWidth)}  ${axis.values.join(" | ")}  (default ${axis.default}, ${axis.origin})`,
    );
  }
  if (axes.length === 0) lines.push("  none");
  for (const missing of report.sourceOnlyAxes) {
    lines.push(
      `  in the source but not in the contract: ${missing.prop} (${missing.values.join(" | ")})`,
    );
  }
  lines.push("", "Slots");
  for (const slot of report.slots) {
    const composes = slot.composes ? `, composes ${slot.composes}` : "";
    lines.push(`  ${slot.name} -> ${slot.part}${slot.required ? ", required" : ""}${composes}`);
  }
  if (report.slots.length === 0) lines.push("  none");
  lines.push("", `Examples: ${report.examples}`);
  if (report.omittedParts.length > 0) {
    lines.push(`Omitted parts: ${report.omittedParts.join(", ")}`);
  }
  if (report.split) {
    lines.push(
      Array.isArray(report.split)
        ? `Split: one set per combination of "${report.split.join('" and "')}"`
        : `Split: one set per value of "${report.split}"`,
    );
  }
  if (report.buildingBlocks) lines.push(`Building Blocks: ${report.buildingBlocks.join(", ")}`);
  if (report.capReason) lines.push(`Cap reason: ${report.capReason}`);
  return ok(lines.join("\n"), report);
}

/**
 * Writes a starter contract for a component that has source and CSS, choosing one interactively
 * when no slug is given. Asks before replacing an existing contract unless forced.
 */
async function runNew(input: CommandInput, env: CommandEnvironment): Promise<CommandResult> {
  const root = findWorkspaceRoot(env.cwd, input.options.root);
  const project = await loadProject({ root, packageDir: env.packageDir });
  const slug = await slugOrChoose(
    input,
    env,
    "new",
    componentDirectories(project.components.dir).filter(
      (directory) =>
        existsSync(join(project.components.dir, directory, `${directory}.tsx`)) &&
        existsSync(join(project.components.dir, directory, `${directory}.css`)),
    ),
    "Which component needs a contract?",
  );
  const componentDir = join(project.components.dir, slug);
  const sourcePath = join(componentDir, `${slug}.tsx`);
  const cssPath = join(componentDir, `${slug}.css`);
  if (!existsSync(sourcePath) || !existsSync(cssPath)) {
    throw new UsageError(
      `No component "${slug}": expected ${relative(root, sourcePath)} and ${relative(root, cssPath)}.`,
      "component-unknown",
    );
  }
  const contractPath = join(componentDir, `${slug}.figma.contract.ts`);
  const shown = relative(root, contractPath);
  if (existsSync(contractPath) && input.options.force !== true && input.options.yes !== true) {
    const replace =
      mayPrompt(input, env) &&
      (await (env.prompter ?? createTerminalPrompter()).confirm(
        `${shown} already exists. Replace it with a fresh starter?`,
      ));
    if (!replace) {
      throw new ContractsError(
        `${shown} already exists. Edit it, or run \`new ${slug} --force\` to replace it.`,
        EXIT.refusal,
        "contract-exists",
        shown,
      );
    }
  }
  const starter = renderStarterContract({
    slug,
    tsxSource: readFileSync(sourcePath, "utf8"),
    cssSource: readFileSync(cssPath, "utf8"),
    sourcePath,
  });
  writeFileSync(contractPath, starter.source);
  const lines = [`Wrote ${shown}`, ...starter.notes.map((note) => `Note: ${note}`)];
  lines.push(`Run \`validate ${slug}\` to check it.`);
  return ok(lines.join("\n"), { slug, path: shown, notes: starter.notes });
}

type Handler = (input: CommandInput, env: CommandEnvironment) => Promise<CommandResult>;

const HANDLERS: Record<CommandName, Handler> = {
  compile: runCompile,
  check: runCheck,
  validate: runValidate,
  list: runList,
  explain: runExplain,
  new: runNew,
};

/** Runs a named command with its input and environment and returns the result. */
export function runCommand(
  name: CommandName,
  input: CommandInput,
  env: CommandEnvironment,
): Promise<CommandResult> {
  return HANDLERS[name](input, env);
}
