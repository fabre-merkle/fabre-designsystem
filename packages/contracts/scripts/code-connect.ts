#!/usr/bin/env bun
/**
 * Generate or check the project's Code Connect templates (`.figma.ts`).
 *
 *   bun scripts/code-connect.ts            write every template
 *   bun scripts/code-connect.ts --check    fail on any missing or changed template (no token)
 *
 * Options: --package <import specifier>, --components-dir <dir>, --out-dir <dir> (default: the
 * components dir, so each template sits next to its component).
 *
 * A generated template the generator no longer produces (its component left the contract or lost
 * its node id) is obsolete: `--check` fails on it and write mode removes it. Only files carrying the
 * generator's header are touched; hand-written templates are left alone.
 *
 * Inputs: the compiled contract artifact (variant values per component) and the generation
 * manifest written after a library is generated (Figma node ids). Components without a manifest
 * entry are skipped, because they have not been generated in Figma yet. A component that splits
 * into one set per value of an axis gets one template per set (`<slug>.<value>.figma.ts`), each
 * with the value as a fixed prop, read from the manifest's `sets`; each Building Block gets one
 * (`<slug>.<part>.figma.ts`), read from `buildingBlocks`. Exit 0 ok, 1 drift.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  type ComponentContract,
  codeSourceFor,
  diffTemplates,
  type FigmaManifest,
  planTemplates,
  type TemplateRequest,
} from "../src/code-connect";
import { createCodePropsReader } from "./code-props";

const ARTIFACT = ".agents/figma-generation-contract.json";
const MANIFEST = ".agents/figma.json";

type ArtifactContract = ComponentContract & { slug: string; source?: { slug: string } };

interface ArtifactComponent {
  contract: ArtifactContract;
  /** The compiled Building Blocks, each with the contract of its own hidden set. */
  buildingBlocks?: Array<{ part: string; contract: ArtifactContract }>;
}

/** Read a CLI option's value, or the default when absent. */
function option(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const check = process.argv.includes("--check");
const importPath = option("--package", "@workspace/ui");
const componentsDir = option("--components-dir", "packages/ui/src/components");
const outDir = option("--out-dir", componentsDir);

const hasManifest = existsSync(MANIFEST);
if (hasManifest && !existsSync(ARTIFACT)) {
  console.error(`code-connect: ${ARTIFACT} is missing; run the contract compile first.`);
  process.exit(1);
}

// Without a manifest nothing is generated in Figma yet, so no template is expected. Generated
// templates left over from an earlier run are still found and reported as obsolete.
const manifest: FigmaManifest = hasManifest
  ? (JSON.parse(readFileSync(MANIFEST, "utf8")) as FigmaManifest)
  : { fileKey: "", components: {} };
const artifact = hasManifest
  ? (JSON.parse(readFileSync(ARTIFACT, "utf8")) as { components: ArtifactComponent[] })
  : { components: [] as ArtifactComponent[] };

/** Every `<out-dir>/<component>/<component>.figma.ts` currently on disk. */
function listExistingTemplates(): string[] {
  if (!existsSync(outDir)) return [];
  return readdirSync(outDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) =>
      readdirSync(join(outDir, d.name))
        .filter((f) => f.endsWith(".figma.ts"))
        .map((f) => `${outDir}/${d.name}/${f}`),
    );
}

let expected: ReturnType<typeof planTemplates>;
try {
  // A component is wanted once the manifest names a node for it: its set, or a set per split value.
  const wanted = artifact.components.filter((c) => {
    const entry = manifest.components[c.contract.componentName];
    return Boolean(entry?.nodeId || entry?.setId || Object.keys(entry?.sets ?? {}).length > 0);
  });
  // One program for every component: a program per component re-checks React and Base UI each time.
  const all = artifact.components.map((c) => c.contract);
  const sources = wanted.map((c) => codeSourceFor(c.contract, all));
  const blockSources = wanted.map((c) =>
    (c.buildingBlocks ?? []).map((block) => codeSourceFor(block.contract, all)),
  );
  const reader = createCodePropsReader(
    [...sources, ...blockSources.flat()].map((s) => `${componentsDir}/${s.dir}/index.ts`),
  );
  const requests: TemplateRequest[] = wanted.map((c, i) => {
    const { dir, exportName, member } = sources[i];
    const { props, renderTag } = reader.resolve(
      `${componentsDir}/${dir}/index.ts`,
      exportName,
      member,
    );
    const buildingBlocks = (c.buildingBlocks ?? []).map((block, k) => {
      const blockSource = blockSources[i][k];
      const resolved = reader.resolve(
        `${componentsDir}/${blockSource.dir}/index.ts`,
        blockSource.exportName,
        blockSource.member,
      );
      return {
        part: block.part,
        contract: block.contract,
        codeProps: resolved.props,
        renderTag: resolved.renderTag,
        // A block is a member of its component's namespace export (`Select.Item`).
        importName: blockSource.exportName,
        path: `${outDir}/${blockSource.dir}/${c.contract.slug}.${block.part}.figma.ts`,
      };
    });
    return {
      contract: c.contract,
      codeProps: props,
      renderTag,
      // A part imports its source component's export (`Field`), not its own name.
      ...(member ? { importName: exportName } : {}),
      importPath,
      // A part's template sits beside its contract, in the source component's folder.
      path: `${outDir}/${dir}/${c.contract.slug}.figma.ts`,
      ...(buildingBlocks.length > 0 ? { buildingBlocks } : {}),
    };
  });
  expected = planTemplates(manifest, requests);
} catch (error) {
  console.error(`code-connect: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

if (check) {
  const report = diffTemplates(
    expected,
    (p) => (existsSync(p) ? readFileSync(p, "utf8") : undefined),
    listExistingTemplates,
  );
  for (const p of report.missing) console.error(`code-connect: missing ${p}`);
  for (const p of report.changed) console.error(`code-connect: out of date ${p}`);
  for (const p of report.conflicts) {
    console.error(`code-connect: ${p} is hand-written (no generated header); not managed`);
  }
  for (const p of report.obsolete) console.error(`code-connect: obsolete ${p}`);
  if (!report.ok) {
    console.error(
      "Regenerate the templates (run this script without --check) and commit the result.",
    );
    process.exit(1);
  }
  console.log(`code-connect: ${expected.length} template(s) match the generator.`);
} else {
  const before = diffTemplates(
    expected,
    (p) => (existsSync(p) ? readFileSync(p, "utf8") : undefined),
    listExistingTemplates,
  );
  // Never overwrite a hand-written template: refuse before writing anything.
  if (before.conflicts.length > 0) {
    for (const p of before.conflicts) {
      console.error(`code-connect: ${p} is hand-written (no generated header); not overwriting`);
    }
    console.error(
      "Move or delete the hand-written file, or remove the component from the manifest.",
    );
    process.exit(1);
  }
  for (const t of expected) {
    mkdirSync(dirname(t.path), { recursive: true });
    writeFileSync(t.path, t.content);
  }
  // Remove only templates the generator owns (its header) that it no longer produces.
  for (const p of before.obsolete) rmSync(p);
  console.log(
    `code-connect: wrote ${expected.length} template(s), removed ${before.obsolete.length} obsolete.`,
  );
}
