import { componentSetIdentities, splitAxesOf } from "../generation-contract/component-sets";
import { generateCodeConnect } from "./generate";
import { GENERATED_MARKER } from "./serialize";
import type { CodeProps, ComponentContract, FigmaManifest } from "./types";

/** A Code Connect template the generator expects to find on disk. */
export interface ExpectedTemplate {
  /** Repo-relative path of the `.figma.ts` file. */
  path: string;
  /** The exact source the generator emits. */
  content: string;
}

/** The result of comparing generated templates with the committed ones. */
export interface DriftReport {
  /** Expected templates with no file on disk. */
  missing: string[];
  /** Templates whose committed content differs from the generator output. */
  changed: string[];
  /** Expected paths occupied by a file the generator does not own (a hand-written template). */
  conflicts: string[];
  /** Generator-owned templates that exist on disk but that the generator no longer produces. */
  obsolete: string[];
  /** True when nothing is missing, changed, in conflict or obsolete. */
  ok: boolean;
}

/** One component the project wants a template for. */
export interface TemplateRequest {
  contract: ComponentContract;
  codeProps: CodeProps;
  /** The renderable tag when it is not the export itself (a compound component's `X.Root`). */
  renderTag?: string;
  /** The exported name to import when it is not the contract's `componentName`. */
  importName?: string;
  importPath: string;
  /** Repo-relative path the template lives at, normally next to the component source. */
  path: string;
  /**
   * The component's Building Blocks, each with its own contract and the code facts of the part's
   * member component (`Select.Item`), and the path its template lives at.
   */
  buildingBlocks?: BuildingBlockTemplateRequest[];
}

/** One Building Block's template: the block's compiled contract and the member it maps. */
export interface BuildingBlockTemplateRequest {
  /** The declared part, which keys the block in the manifest. */
  part: string;
  contract: ComponentContract;
  codeProps: CodeProps;
  renderTag?: string;
  importName?: string;
  path: string;
}

/** The template path of one set of a split component: `button.primary.figma.ts`. */
export function splitTemplatePath(path: string, value: string): string {
  return path.replace(/\.figma\.ts$/, `.${value}.figma.ts`);
}

/**
 * Generate the expected templates for every requested component: one for the component, one for
 * each set of a split component (the split value is a fixed prop), and one for each Building
 * Block. A component with no manifest entry, or a set or block with no node id, throws, because
 * Code Connect needs the Figma node id the manifest holds.
 */
export function planTemplates(
  manifest: FigmaManifest,
  requests: readonly TemplateRequest[],
): ExpectedTemplate[] {
  return requests.flatMap((request) => {
    const { contract, codeProps, renderTag, importName, importPath, path } = request;
    const entry = manifest.components[contract.componentName];
    if (!entry) {
      throw new Error(
        `The manifest has no entry for "${contract.componentName}"; generate it in Figma first.`,
      );
    }
    const templates: ExpectedTemplate[] = [];
    const common = { codeProps, fileKey: manifest.fileKey, importPath, renderTag, importName };
    const split = contract.split;
    if (!split && !contract.shapes?.length) {
      templates.push({
        path,
        content: generateCodeConnect({ ...common, contract, manifest: entry }),
      });
    } else {
      const sets = componentSetIdentities(contract, contract.axes);
      if (sets.length === 0) {
        throw new Error(
          `"${contract.componentName}" splits on undeclared axis "${splitAxesOf(split ?? { axis: [] }).join('", "')}".`,
        );
      }
      for (const { value, fixed } of sets) {
        const node = entry.sets?.[value];
        if (!node?.nodeId && !node?.setId) {
          throw new Error(
            `The manifest has no "${value}" set for "${contract.componentName}"; generate it in Figma first.`,
          );
        }
        templates.push({
          path: splitTemplatePath(path, value),
          content: generateCodeConnect({
            ...common,
            contract,
            manifest: { source: entry.source, ...node },
            split: { values: fixed, id: value },
          }),
        });
      }
    }
    for (const block of request.buildingBlocks ?? []) {
      const node = entry.buildingBlocks?.[block.part];
      const blockCommon = {
        contract: block.contract,
        codeProps: block.codeProps,
        fileKey: manifest.fileKey,
        importPath,
        renderTag: block.renderTag,
        importName: block.importName,
      };
      // A split block maps each of its sets to the part's member, as a split component does.
      if (block.contract.split) {
        const sets = componentSetIdentities(block.contract, block.contract.axes);
        if (sets.length === 0) {
          throw new Error(
            `Building Block "${block.part}" of "${contract.componentName}" splits on undeclared axis "${splitAxesOf(block.contract.split).join('", "')}".`,
          );
        }
        for (const { value, fixed } of sets) {
          const setNode = node?.sets?.[value];
          if (!setNode?.nodeId && !setNode?.setId) {
            throw new Error(
              `The manifest has no "${value}" set of Building Block "${block.part}" for "${contract.componentName}"; generate it in Figma first.`,
            );
          }
          templates.push({
            path: splitTemplatePath(block.path, value),
            content: generateCodeConnect({
              ...blockCommon,
              manifest: { source: entry.source, ...setNode },
              split: { values: fixed, id: value },
            }),
          });
        }
        continue;
      }
      if (!node?.nodeId && !node?.setId) {
        throw new Error(
          `The manifest has no Building Block "${block.part}" for "${contract.componentName}"; generate it in Figma first.`,
        );
      }
      templates.push({
        path: block.path,
        content: generateCodeConnect({
          ...blockCommon,
          manifest: { source: entry.source, ...node },
        }),
      });
    }
    return templates;
  });
}

/**
 * True when the text is a generated template: the generator's marker is an exact line inside the
 * leading `//` header block. A hand-written file that merely quotes the marker, in a string or
 * further down, is not generated.
 */
export function isGeneratedTemplate(content: string): boolean {
  for (const line of content.split("\n")) {
    const text = line.replace(/\r$/, "");
    if (!text.startsWith("//")) return false;
    if (text === GENERATED_MARKER) return true;
  }
  return false;
}

/**
 * Compare expected templates with what is committed. `read` returns a file's text, or undefined
 * when it does not exist. `listExisting` returns every `*.figma.ts` path in the template
 * locations; one the generator would not produce is obsolete, but only when it carries the
 * generator's header, so a hand-written template is never reported. A hand-written file at an
 * expected path is a conflict, not a change: it is never overwritten. Tokenless and offline: this is
 * the pull-request check that keeps committed templates equal to the generator output.
 */
export function diffTemplates(
  expected: readonly ExpectedTemplate[],
  read: (path: string) => string | undefined,
  listExisting: () => readonly string[] = () => [],
): DriftReport {
  const missing: string[] = [];
  const changed: string[] = [];
  const conflicts: string[] = [];
  for (const t of expected) {
    const actual = read(t.path);
    if (actual === undefined) missing.push(t.path);
    else if (!isGeneratedTemplate(actual)) conflicts.push(t.path);
    else if (actual !== t.content) changed.push(t.path);
  }
  const wanted = new Set(expected.map((t) => t.path));
  const obsolete = listExisting().filter((p) => {
    if (wanted.has(p)) return false;
    const text = read(p);
    return text !== undefined && isGeneratedTemplate(text);
  });
  return {
    missing,
    changed,
    conflicts,
    obsolete,
    ok:
      missing.length === 0 &&
      changed.length === 0 &&
      conflicts.length === 0 &&
      obsolete.length === 0,
  };
}

/**
 * The Figma property names a generated template reads, grouped by accessor
 * (`getEnum`, `getSlot`, `getString`, `getBoolean`, `getInstanceSwap`). Used to check that a
 * template reads only properties the plugin actually creates.
 */
export function readPropertyNames(source: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const m of source.matchAll(
    /instance\.(getEnum|getSlot|getString|getBoolean|getInstanceSwap|getPropertyValue)\(\s*"([^"]+)"/g,
  )) {
    out[m[1]] = [...(out[m[1]] ?? []), m[2]];
  }
  return out;
}

/**
 * The JSX attribute names a generated template passes to the component. Used to check that every
 * emitted prop exists on the component's own type.
 */
export function emittedAttributeNames(source: string): string[] {
  const body = /example: figma\.code`([\s\S]*?)\n {2}`,/.exec(source)?.[1] ?? "";
  const open = /<([A-Z][\w.]*)\s*([\s\S]*?)\/?>(?!\$)/.exec(body)?.[2] ?? "";
  const names = new Set<string>();
  for (const m of open.matchAll(/(?:^|[\s`])([A-Za-z_$][\w$]*)=(?:"|\{)/g)) names.add(m[1]);
  // A boolean axis prop is a bare quoted attribute: `"iconOnly"` or `"iconOnly={false}"`.
  for (const m of open.matchAll(/"([A-Za-z_$][\w$]*)(?:=\{false\})?"/g)) names.add(m[1]);
  // A closing tag means the example renders children between the tags.
  if (/<\/[A-Z][\w.]*>/.test(body)) names.add("children");
  return [...names];
}
