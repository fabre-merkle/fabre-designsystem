import { type DocsStoryPreset, jsxSnippet } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { WebGridDemo, type WebGridDemoPresetOnly, type WebGridDemoProps } from "./web-grid-demo";

export const title = "Web Grid";
// The controls are generated from `WebGridDemoProps` when this file compiles.
// (Edit this file after changing that type, so the generated controls refresh.)

/** Arguments that shape the example and are not Grid props: drawn in the "Demo" group. */
export const demoArgs = ["cells"] as const;

type Args = WebGridDemoProps & WebGridDemoPresetOnly;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  variant: "3up",
  gap: "gutter",
  margin: false,
  container: false,
  cells: 6,
} satisfies WebGridDemoProps;

export const presets: DocsStoryPreset<Args>[] = [
  {
    variant: "Equal columns",
    description:
      "1up to 4up are equal columns. Change variant to compare. 3up and 4up collapse as the web breakpoint narrows.",
    initial: base,
  },
  {
    variant: "Two to one",
    description: "2-1 splits the row two to one, and 1-2 the other way round.",
    initial: { ...base, variant: "2-1", cells: 2 },
  },
  {
    variant: "Auto",
    description:
      "Fits as many columns as the width allows, each at least 256px at the default scale. It never collapses by breakpoint.",
    initial: { ...base, variant: "auto", cells: 5 },
  },
  {
    variant: "Small gap",
    description:
      "The gap is none, sm, base, lg or gutter. The first four map to spacing tokens; gutter reads the breakpoint-aware web grid gutter.",
    initial: { ...base, gap: "sm", cells: 3 },
  },
  {
    variant: "Large gap",
    description: "lg maps to a spacing token like sm and base.",
    initial: { ...base, gap: "lg", cells: 3 },
  },
  {
    variant: "Spans",
    description: "span on Grid.Item takes 2, 3 or 4 columns, or full for the whole row.",
    initial: { ...base, showSpans: true },
  },
  {
    variant: "Page margin",
    description:
      "margin insets the grid by the breakpoint-aware page margin. Use it on the outermost grid of a page.",
    initial: { ...base, variant: "2up", margin: true, cells: 2 },
  },
  {
    variant: "Container mode",
    description:
      "Both grids sit in the same narrow box on a desktop page. The first collapses on the page breakpoint, so it keeps three columns; the second collapses against its own width, so it is one column.",
    initial: { ...base, compare: true },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet(props: Args): string {
  const { variant, gap, margin, container, cells = 6, showSpans, compare } = props;
  const defaults = { variant: "2up", gap: "base" };
  const cell = (n: number | string) => `  <Grid.Item>${n}</Grid.Item>`;
  if (compare) {
    const open = (extra: Record<string, unknown>) =>
      jsxSnippet("Grid.Root", { variant, gap, ...extra }, { openOnly: true, defaults });
    return [
      open({}),
      "  {/* Collapses on the page breakpoint. */}",
      "</Grid.Root>",
      "",
      open({ container: true }),
      "  {/* Collapses against its own width. */}",
      "</Grid.Root>",
    ].join("\n");
  }
  const open = jsxSnippet(
    "Grid.Root",
    { variant, gap, margin, container },
    { openOnly: true, defaults },
  );
  const children = showSpans
    ? [
        '  <Grid.Item span="full">full</Grid.Item>',
        "  <Grid.Item span={2}>span 2</Grid.Item>",
        cell(1),
      ]
    : Array.from({ length: Math.max(1, cells) }, (_, i) => cell(i + 1));
  return [open, ...children, "</Grid.Root>"].join("\n");
}

export const story = defineStory({
  displayName: "Web Grid",
  Component: WebGridDemo,
  args: presets,
});
