/**
 * Compiles a project's co-located Figma generation contracts into the one artifact the Figma
 * plugin reads, `.agents/figma-generation-contract.json`, and into the component catalogue agents
 * read, `.agents/component-catalogue.json`. Both come from the same compile, so they cannot
 * disagree.
 *
 * Contracts are discovered next to the components, validated against the authored schema, paired
 * with their component source and stylesheet, and handed to the engine. Nothing here is specific
 * to a Figma flow: it needs only the components, the package's config and its layout manifest.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import {
  buildGenerationContractArtifact,
  type CompiledGenerationContract,
  type CompileGenerationContractInput,
  type FigmaGenerationContract,
  GENERATION_CONTRACT_SOURCE_SCHEMA_VERSION,
} from "../generation-contract";
import { parseFigmaContractForCompiler } from "../generation-contract/authored-schema";
import {
  buildComponentCatalogue,
  CATALOGUE_PATH,
  type ComponentGuidance,
  GUIDANCE_PATH,
  parseComponentGuidanceText,
  serializeComponentCatalogue,
} from "../generation-contract/catalogue";
import {
  componentSetReports,
  type SetReport,
  variantCapWarnings,
} from "../generation-contract/component-sets";
import {
  type Diagnostic,
  diagnostic,
  diagnosticPath,
  RefusalError,
  refusal,
} from "../generation-contract/diagnostics";
import { focusRingDroppedWarning } from "../generation-contract/focus-ring";
import { createNodeImageAssetResolver } from "../generation-contract/node-image-loader";
import { fragmentValueSets, type StaticScope, selectorEvaluable } from "../registry/anatomy-match";
import {
  findSkippedSelectors,
  findUnsupportedCss,
  parseSelectorVariants,
} from "../registry/css-parser";
import {
  setKnownVariableMap,
  setProjectTokenNames,
  setResolvedTokenPxValues,
} from "../registry/resolver";
import { isStandardStateAxis } from "../registry/state-axis";
import {
  type ContractsConfig,
  DEFAULT_TOKENS_DIR,
  type LayoutManifest,
  loadContractsConfig,
  loadLayoutManifest,
} from "./config";
import { contractHashes } from "./contract-hash";
import { type ComponentsRoot, componentDirectories, discoverComponentsRoot } from "./discovery";
import { MANIFEST_FILE, schemaDeviation } from "./manifest";
import { MissingPrerequisiteError } from "./prerequisites";
import { assertPartsSized } from "./size-gate";
import { loadProjectTokens } from "./tokens";

export const ARTIFACT_PATH = ".agents/figma-generation-contract.json";
export { CATALOGUE_PATH, GUIDANCE_PATH };

export interface CompileOptions {
  /** The workspace root: the artifact is written under it. */
  root: string;
  /** The installed package directory (holds the config and the layout manifest). */
  packageDir: string;
}

/** Serialises a value as pretty-printed JSON with a trailing newline so output is byte-stable. */
function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/**
 * Whether two JSON texts hold the same data, ignoring whitespace and line breaks. The catalogue is
 * small enough for a formatter to rewrite on commit, so its check compares data, not bytes.
 */
function sameJson(left: string, right: string): boolean {
  try {
    return JSON.stringify(JSON.parse(left)) === JSON.stringify(JSON.parse(right));
  } catch {
    return false;
  }
}

/** A relative path with forward slashes, whatever the platform. */
function posixRelative(from: string, to: string): string {
  return relative(from, to).split(sep).join("/");
}

/** Imports a contract file and returns the one current contract object it exports, unchecked. */
export async function importContract(file: string, root: string): Promise<FigmaGenerationContract> {
  const module = await import(pathToFileURL(file).href);
  const contracts = Object.values(module).filter(
    (value): value is FigmaGenerationContract =>
      Boolean(value) &&
      typeof value === "object" &&
      (value as { schemaVersion?: unknown }).schemaVersion ===
        GENERATION_CONTRACT_SOURCE_SCHEMA_VERSION,
  );
  if (contracts.length !== 1) {
    throw refusal(
      "contract-file-invalid",
      `Expected one current Figma generation contract in ${relative(root, file)}, found ${contracts.length}.`,
      posixRelative(root, file),
    );
  }
  return contracts[0];
}

/** One contract file in a component folder under the component root. */
export interface ContractEntry {
  /** The component folder name that holds the source (`.tsx` and `.css`). */
  directory: string;
  /**
   * The contract's own slug, from its file name. It equals `directory` for a component's own
   * contract (`field/field.figma.contract.ts`); a part-component contract
   * (`field/field-label.figma.contract.ts`, with `source.slug` = `field`) has its own.
   */
  slug: string;
  componentDir: string;
  contractPath: string;
}

export interface Project {
  root: string;
  config: ContractsConfig;
  layoutManifest: LayoutManifest;
  components: ComponentsRoot;
  /** Every component folder with a `<dir>.figma.contract.ts`, in artifact order. */
  entries: ContractEntry[];
}

/** Reads the project's config and finds its contracts. Imports no contract. */
export async function loadProject(options: CompileOptions): Promise<Project> {
  const { root, packageDir } = options;
  const config = await loadContractsConfig(packageDir);
  const layoutManifest = await loadLayoutManifest(packageDir);
  const components = discoverComponentsRoot(root, config.componentsDir);
  const entries: ContractEntry[] = [];
  for (const directory of componentDirectories(components.dir)) {
    const componentDir = join(components.dir, directory);
    // The component's own contract first, then any part-component contracts built from its source.
    const suffix = ".figma.contract.ts";
    const files = readdirSync(componentDir)
      .filter((file) => file.endsWith(suffix))
      .sort(
        (a, b) =>
          Number(b === `${directory}${suffix}`) - Number(a === `${directory}${suffix}`) ||
          a.localeCompare(b),
      );
    for (const file of files) {
      entries.push({
        directory,
        slug: file.slice(0, -suffix.length),
        componentDir,
        contractPath: join(componentDir, file),
      });
    }
  }
  return { root, config, layoutManifest, components, entries };
}

/** Loads, checks against the schema and pairs one contract with its component source. */
export async function loadInput(
  project: Project,
  entry: ContractEntry,
): Promise<CompileGenerationContractInput> {
  const { root, config, layoutManifest } = project;
  const { directory, slug, componentDir, contractPath } = entry;
  const contract = parseFigmaContractForCompiler(
    await importContract(contractPath, root),
    relative(root, contractPath),
  );
  // A part-component contract names the component that owns its source; its slug is its own file
  // name. Any other contract's slug is its component directory.
  if (contract.slug !== slug || (contract.source?.slug ?? contract.slug) !== directory) {
    throw refusal(
      "slug-mismatch",
      contract.source
        ? `Contract "${contract.slug}" in ${relative(root, contractPath)} must be named "${contract.slug}.figma.contract.ts" inside its source component directory "${contract.source.slug}".`
        : `Contract "${contract.slug}" in ${relative(root, contractPath)} must match its component directory "${directory}".`,
      diagnosticPath(contract.slug, ["slug"]),
    );
  }
  const sourcePath = join(componentDir, `${directory}.tsx`);
  const cssPath = join(componentDir, `${directory}.css`);
  const componentPath = posixRelative(root, sourcePath);
  const stylesheetPath = posixRelative(root, cssPath);
  if (!existsSync(sourcePath) || !existsSync(cssPath)) {
    throw refusal(
      "component-files-missing",
      `Contract "${contract.slug}" requires co-located source and stylesheet: ${componentPath}, ${stylesheetPath}.`,
      diagnosticPath(contract.slug),
    );
  }
  const cssSource = readFileSync(cssPath, "utf8");
  const unsupported = findUnsupportedCss(cssSource);
  if (unsupported.length > 0) {
    throw new RefusalError(
      `${stylesheetPath} uses CSS outside the supported style:\n${unsupported
        .map((entry) => `  line ${entry.line}: ${entry.reason}`)
        .join("\n")}`,
      unsupported.map((entry) =>
        diagnostic(
          "css-unsupported",
          `${stylesheetPath} line ${entry.line}: ${entry.reason}`,
          diagnosticPath(contract.slug, ["stylesheet", entry.line]),
        ),
      ),
    );
  }
  return {
    contract,
    documentationTheme: config.documentationTheme,
    tsxSource: readFileSync(sourcePath, "utf8"),
    sourcePath,
    cssSource,
    componentPath,
    stylesheetPath,
    // A `kind: "image"` anatomy node's declared `imageAssetPath` resolves against this
    // component's own directory; its asset ships beside `<dir>.tsx` and `<dir>.css`.
    resolveImageAsset: createNodeImageAssetResolver(componentDir),
    // Keyed by the source component directory, like the monorepo compiler: a part contract
    // (`field-label`) reads its geometry from its source component's entry (`field`).
    layoutManifest: layoutManifest[directory],
  };
}

/** The error reported when a project has no contract files, naming where it looked. */
function noContractsError(project: Project): MissingPrerequisiteError {
  const { root, components } = project;
  return new MissingPrerequisiteError(
    `No *.figma.contract.ts found under ${relative(root, components.dir) || "."} ` +
      `(from ${components.source}). Install a component that ships a contract, or point ` +
      "aliases.ui in components.json or componentsDir in contracts.config.ts at the directory " +
      "that holds them.",
    "no-contracts",
  );
}

/**
 * Runs `build` with the resolver holding the project's token facts (variable spellings, which
 * custom properties are tokens, number values), then clears them again so one project's tokens
 * never reach another compile in the same process. Refuses a project without DTCG: sizes written
 * as `calc()` over tokens cannot be resolved without their values, and an unresolved size leaves a
 * shape at Figma's 100 x 100 default.
 */
export function withProjectTokens<T>(project: Project, build: () => T): T {
  const dir = project.config.tokensDir ?? DEFAULT_TOKENS_DIR;
  const tokens = loadProjectTokens(resolve(project.root, dir), dir);
  setKnownVariableMap(tokens.variableNames);
  setProjectTokenNames(tokens.variableNames.values());
  setResolvedTokenPxValues(tokens.pxValues);
  try {
    return build();
  } finally {
    setKnownVariableMap(undefined);
    setProjectTokenNames(undefined);
    setResolvedTokenPxValues(undefined);
  }
}

/** The parts of a compiled component the warnings read. */
type WarnedComponent = Pick<CompiledGenerationContract, "buildingBlocks"> & {
  contract: Pick<
    FigmaGenerationContract,
    "slug" | "source" | "componentName" | "split" | "axes" | "capReason" | "buildingBlocks"
  >;
  resolvedPlan: {
    refusedDescendantOverrides?: Record<string, string>;
    variantMatrix: ReadonlyArray<{ key: Record<string, string> }>;
  };
};

/**
 * What the compile succeeded in spite of: the project's schema has drifted from the base it was
 * installed from, and a parent's stylesheet restyles a composed child in a way Figma cannot
 * override. Neither stops the artifact being written, so both are warnings.
 */
export function artifactWarnings(
  packageDir: string,
  components: readonly WarnedComponent[],
): Diagnostic[] {
  const warnings: Diagnostic[] = [];
  const deviation = schemaDeviation(packageDir);
  if (deviation?.deviated) {
    warnings.push(
      diagnostic(
        "schema-deviated",
        `The contract schema differs from base schema ${deviation.baseSchemaVersion} ` +
          `(expected ${deviation.expected}, found ${deviation.actual}).`,
        MANIFEST_FILE,
      ),
    );
  }
  for (const component of components) {
    const refused = component.resolvedPlan.refusedDescendantOverrides ?? {};
    for (const [fragment, reason] of Object.entries(refused)) {
      warnings.push(
        diagnostic(
          "descendant-override",
          `${fragment}: ${reason}`,
          diagnosticPath(component.contract.slug, ["refusedDescendantOverrides", fragment]),
        ),
      );
    }
  }
  warnings.push(...variantCapWarnings(components));
  return warnings;
}

/** The selector fragments a contract's axes express, such as `[data-size="md"]` or `[data-panel-open]`. */
function axisFragmentsOf(
  axes: readonly {
    values?: readonly string[];
    attribute?: string;
    valueSelectors?: Record<string, string | null>;
    partValueSelectors?: Record<string, Record<string, string | null>>;
    attributeOmittedWhenNull?: boolean;
  }[],
): Set<string> {
  const fragments = new Set<string>();
  for (const axis of axes) {
    const values = axis.values ?? Object.keys(axis.valueSelectors ?? {});
    const read = (selectors?: Record<string, string | null>) =>
      values.map((value) =>
        selectors && value in selectors
          ? selectors[value]
          : axis.valueSelectors && value in axis.valueSelectors
            ? axis.valueSelectors[value]
            : axis.attribute
              ? `[${axis.attribute}="${value}"]`
              : null,
      );
    // The axis-level selectors, then each part's own over the axis-level ones, split into the
    // attributes the resolver reads (`fragmentValueSets`).
    for (const fragment of fragmentValueSets(read()).keys()) fragments.add(fragment);
    for (const selectors of Object.values(axis.partValueSelectors ?? {})) {
      for (const fragment of fragmentValueSets(read(selectors)).keys()) fragments.add(fragment);
    }
    if (axis.attributeOmittedWhenNull && axis.attribute) fragments.add(`[${axis.attribute}]`);
  }
  return fragments;
}

/** A selector short enough for one line of a report. */
function shortened(selector: string, limit = 90): string {
  return selector.length > limit ? `${selector.slice(0, limit - 3)}...` : selector;
}

/** A warning for each contract whose root has a `:focus-visible` outline nothing covers. */
export function focusRingWarnings(
  inputs: readonly Pick<CompileGenerationContractInput, "contract" | "cssSource">[],
): Diagnostic[] {
  return inputs.flatMap((input) => {
    const warning = focusRingDroppedWarning(
      {
        slug: input.contract.slug,
        rootPart: input.contract.rootPart,
        axes: input.contract.axes,
        focusRing: input.contract.focusRing,
      },
      input.cssSource,
    );
    return warning ? [warning] : [];
  });
}

/**
 * The rules aimed at a part a contract models whose selectors the compiler does not evaluate
 * (`:has()`, a `:not()` with more than attribute selectors, structural pseudo-classes and the
 * like). Browsers apply these rules and Figma never receives their bindings, so each is reported
 * once per stylesheet. They are warnings, not part of the artifact.
 */
export function selectorWarnings(
  inputs: readonly Pick<
    CompileGenerationContractInput,
    "contract" | "cssSource" | "stylesheetPath"
  >[],
): Diagnostic[] {
  const warnings: Diagnostic[] = [];
  // Contracts that share a stylesheet (a part contract beside its source component) model
  // different parts, so the parts are united per stylesheet before anything is reported.
  const byStylesheet = new Map<
    string,
    {
      first: (typeof inputs)[number];
      modelled: Set<string>;
      omitted: Set<string>;
      axisFragments: Set<string>;
      everyAnatomy: boolean;
      evaluatesState: boolean;
    }
  >();
  for (const input of inputs) {
    const group = byStylesheet.get(input.stylesheetPath) ?? {
      first: input,
      modelled: new Set<string>(),
      omitted: new Set<string>(),
      axisFragments: new Set<string>(),
      everyAnatomy: true,
      evaluatesState: false,
    };
    // A contract with the State axis has its state pseudo-classes evaluated, so they are not skipped.
    if (
      input.contract.axes?.some((axis) =>
        isStandardStateAxis({ prop: axis.prop, values: axis.values ?? [] }),
      )
    ) {
      group.evaluatesState = true;
    }
    group.modelled.add(input.contract.rootPart);
    for (const part of input.contract.parts ?? []) group.modelled.add(part);
    for (const part of Object.keys(input.contract.omittedParts ?? {})) group.omitted.add(part);
    for (const fragment of axisFragmentsOf(input.contract.axes ?? [])) {
      group.axisFragments.add(fragment);
    }
    if (!input.contract.anatomy) group.everyAnatomy = false;
    byStylesheet.set(input.stylesheetPath, group);
  }
  for (const [stylesheetPath, group] of byStylesheet) {
    const { first, modelled } = group;
    const { contract, cssSource } = first;
    const scope: StaticScope = {
      modelled,
      omitted: group.omitted,
      axisFragments: group.axisFragments,
      positions: group.everyAnatomy && group.omitted.size === 0,
    };
    for (const skipped of findSkippedSelectors(cssSource, {
      evaluatesState: group.evaluatesState,
    })) {
      const touched = skipped.targets.filter((part) => modelled.has(part));
      if (touched.length === 0) continue;
      // `:has()` and position pseudo-classes are read from the contract's anatomy, so they are
      // reported only when the anatomy cannot settle the selector for every cell.
      const settled =
        group.everyAnatomy &&
        skipped.anatomyReasons.length > 0 &&
        parseSelectorVariants(skipped.selector).variants.every((variant) =>
          selectorEvaluable(variant, scope),
        );
      const reasons = settled
        ? skipped.reasons.filter((reason) => !skipped.anatomyReasons.includes(reason))
        : skipped.reasons;
      if (reasons.length === 0) continue;
      warnings.push(
        diagnostic(
          "selector-skipped",
          `${stylesheetPath} line ${skipped.line}: \`${shortened(skipped.selector)}\` is not evaluated (${reasons.join("; ")}), so it adds nothing to ${touched.map((part) => `"${part}"`).join(", ")}.`,
          diagnosticPath(contract.slug, ["stylesheet", skipped.line]),
        ),
      );
    }
  }
  return warnings;
}

/**
 * Reads the project's authored guidance sidecar. A project without one has no guidance; a file
 * that is not valid JSON or does not match the format is refused.
 */
export function loadGuidance(root: string): ComponentGuidance | undefined {
  const path = join(root, GUIDANCE_PATH);
  if (!existsSync(path)) return undefined;
  return parseComponentGuidanceText(readFileSync(path, "utf8"), GUIDANCE_PATH);
}

/**
 * The artifact and the catalogue for the project at `options.root`: the exact text written to disk
 * for each, and the warnings. The catalogue merges the guidance sidecar into the compiled contracts.
 */
export async function buildArtifact(options: CompileOptions): Promise<{
  text: string;
  catalogueText: string;
  diagnostics: Diagnostic[];
  hashes: Record<string, string>;
  sets: SetReport[];
}> {
  const project = await loadProject(options);
  const inputs: CompileGenerationContractInput[] = [];
  for (const entry of project.entries) inputs.push(await loadInput(project, entry));
  if (inputs.length === 0) throw noContractsError(project);
  const guidance = loadGuidance(options.root);
  const artifact = withProjectTokens(project, () => {
    const built = buildGenerationContractArtifact(inputs, project.config.documentationPage);
    assertPartsSized(built.components);
    return built;
  });
  const hashes = contractHashes(artifact.components);
  const catalogue = buildComponentCatalogue({
    components: artifact.components.map(({ contract }) => ({
      contract,
      hash: hashes[contract.slug],
    })),
    guidance,
  });
  return {
    text: stableJson(artifact),
    catalogueText: serializeComponentCatalogue(catalogue),
    diagnostics: [
      ...artifactWarnings(options.packageDir, artifact.components),
      ...selectorWarnings(inputs),
      ...focusRingWarnings(inputs),
    ],
    hashes,
    sets: componentSetReports(artifact.components),
  };
}

/** The artifact for the project at `options.root`, as the exact text written to disk. */
export async function buildArtifactText(options: CompileOptions): Promise<string> {
  return (await buildArtifact(options)).text;
}

export interface CompileOutcome {
  /** True when `--check` found the committed artifact current (always true after a write). */
  upToDate: boolean;
  message: string;
  /** Warnings and, for a stale artifact, the refusal. */
  diagnostics: Diagnostic[];
  /** The hash of each normalized contract, keyed by slug. Reported here, never written to the artifact. */
  hashes: Record<string, string>;
  /** Every component set the contracts generate, with its variant count and cap status. */
  sets: SetReport[];
}

/** Writes the artifact and the catalogue. */
export async function compile(options: CompileOptions): Promise<CompileOutcome> {
  const { text, catalogueText, diagnostics, hashes, sets } = await buildArtifact(options);
  for (const [path, content] of [
    [ARTIFACT_PATH, text],
    [CATALOGUE_PATH, catalogueText],
  ] as const) {
    const outputPath = join(options.root, path);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, content);
  }
  return {
    upToDate: true,
    message: `Wrote ${ARTIFACT_PATH} and ${CATALOGUE_PATH}`,
    diagnostics,
    hashes,
    sets,
  };
}

/** Compares the committed artifact and catalogue with a fresh compile. */
export async function check(options: CompileOptions): Promise<CompileOutcome> {
  const { text, catalogueText, diagnostics, hashes, sets } = await buildArtifact(options);
  const stale: Diagnostic[] = [];
  for (const [path, code, name, matches] of [
    [
      ARTIFACT_PATH,
      "artifact-stale",
      "Figma generation artifact",
      (committed: string) => committed === text,
    ],
    [
      CATALOGUE_PATH,
      "catalogue-stale",
      "Component catalogue",
      (committed: string) => sameJson(committed, catalogueText),
    ],
  ] as const) {
    const outputPath = join(options.root, path);
    if (!existsSync(outputPath) || !matches(readFileSync(outputPath, "utf8"))) {
      stale.push(
        diagnostic(
          code,
          `${name} is stale. Run \`bun run figma:contract\` and commit ${path}.`,
          path,
        ),
      );
    }
  }
  if (stale.length > 0) {
    return {
      upToDate: false,
      message: stale.map((item) => item.message).join("\n"),
      diagnostics: [...stale, ...diagnostics],
      hashes,
      sets,
    };
  }
  return {
    upToDate: true,
    message: "figma-generation-contract.json and component-catalogue.json are up to date.",
    diagnostics,
    hashes,
    sets,
  };
}
