/**
 * The starter contract `new <slug>` writes: an authored contract pre-filled from the component's
 * own code, so the person adds only what the code cannot say.
 *
 * Pure: a function over source text. The parts come from the component's `data-ui` names and the
 * axes from its local string-union types (the same reading the compiler does), with one
 * documented example per axis value so the contract passes the all-axes coverage rule as written.
 */
import { extractComponentRegistry } from "../registry/extract-registry";

export interface StarterInput {
  slug: string;
  tsxSource: string;
  cssSource: string;
  /** Absolute path of the component file, so imports of a union type resolve. */
  sourcePath?: string;
}

export interface Starter {
  /** The text of `<slug>.figma.contract.ts`. */
  source: string;
  /** What could not be read from the code and the author should check. */
  notes: string[];
}

function words(slug: string): string[] {
  return slug.split("-").filter(Boolean);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function pascalCase(slug: string): string {
  return words(slug).map(capitalize).join("");
}

export function camelCase(slug: string): string {
  const pascal = pascalCase(slug);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

interface StarterAxis {
  prop: string;
  values: string[];
  default: string;
  attribute: string;
}

/**
 * One example per row, each row taking the next value of every axis (wrapping), so every value of
 * every axis appears in at least one example and no two examples are the same cell.
 */
function coveringExamples(
  axes: readonly StarterAxis[],
): Array<{ label: string; key: Record<string, string> }> {
  const rows = Math.max(1, ...axes.map((axis) => axis.values.length));
  return Array.from({ length: rows }, (_, row) => {
    const key: Record<string, string> = {};
    for (const axis of axes) key[axis.prop] = axis.values[row % axis.values.length] as string;
    const label = axes.length ? Object.values(key).map(capitalize).join(" ") : "Default";
    return { label, key };
  });
}

function literal(value: unknown): string {
  return JSON.stringify(value);
}

export function renderStarterContract(input: StarterInput): Starter {
  const { slug } = input;
  const componentName = pascalCase(slug);
  const registry = extractComponentRegistry({
    name: componentName,
    tsxSource: input.tsxSource,
    sourcePath: input.sourcePath,
    cssSource: input.cssSource,
    componentPath: `${slug}/${slug}.tsx`,
    stylesheetPath: `${slug}/${slug}.css`,
    rootPart: slug,
  });
  const parts = registry.parts;
  const rootPart = parts.includes(slug) ? slug : (parts[0] ?? slug);
  const axes: StarterAxis[] = registry.axes.map((axis) => ({
    prop: axis.prop,
    values: axis.values,
    default: axis.default,
    attribute: axis.attribute,
  }));
  const examples = coveringExamples(axes);

  const notes: string[] = [];
  if (parts.length === 0) {
    notes.push(
      `No data-ui part found in ${slug}.tsx: set rootPart and parts to the names the component renders.`,
    );
  } else if (!parts.includes(slug)) {
    notes.push(
      `No part is named "${slug}", so rootPart is "${rootPart}". Check that it is the root.`,
    );
  }
  if (axes.length === 0) {
    notes.push(
      `No variant axis found in ${slug}.tsx. Add design-only axes by hand if the design needs them.`,
    );
  }

  const axisLines = axes.flatMap((axis) => [
    "    {",
    `      prop: ${literal(axis.prop)},`,
    `      values: ${literal(axis.values)},`,
    `      default: ${literal(axis.default)},`,
    `      attribute: ${literal(axis.attribute)},`,
    "    },",
  ]);
  const exampleLines = examples.map(
    (example) => `      { label: ${literal(example.label)}, key: ${literal(example.key)} },`,
  );

  const source = [
    'import { defineFigmaContract } from "../figma-contract";',
    "",
    "// A starter written from the component's code: the parts, the axes and one example per axis value",
    "// are read from the source. Add only what the code cannot say (the anatomy, slots, literal",
    "// geometry, omitted parts, design-only axes), then check it with `validate`.",
    `export const ${camelCase(slug)}FigmaContract = defineFigmaContract({`,
    "  schemaVersion: 1 as const,",
    `  slug: ${literal(slug)},`,
    `  componentName: ${literal(componentName)},`,
    `  rootPart: ${literal(rootPart)},`,
    `  parts: ${literal(parts.length ? parts : [rootPart])},`,
    ...(axes.length ? ["  axes: [", ...axisLines, "  ],"] : ["  axes: [],"]),
    "  documentation: {",
    '    coverage: "all-axes" as const,',
    "    examples: [",
    ...exampleLines,
    "    ],",
    "  },",
    "});",
    "",
  ].join("\n");

  return { source, notes };
}
