import { type DocsStoryPreset, jsxSnippet } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { SeparatorDemo, type SeparatorDemoProps } from "./separator-demo";

export const title = "Separator";
// The controls are generated from `SeparatorDemoProps` when this file compiles.
// (Edit this file after changing that type, so the generated controls refresh.)

/** Arguments that shape the example and are not Separator props: drawn in the "Demo" group. */
export const demoArgs = ["label"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  variant: "line",
  size: "md",
  orientation: "horizontal",
  label: "Section",
} satisfies SeparatorDemoProps;

export const presets: DocsStoryPreset<SeparatorDemoProps>[] = [
  {
    variant: "Line",
    description: "A pure stroke, the default. Divides unrelated content groups.",
    initial: base,
  },
  {
    variant: "Solid text",
    description: "A label centred on a single stroke, for a labelled section break.",
    initial: { ...base, variant: "solid-text" },
  },
  {
    variant: "Underline",
    description: "A label above a stroke, as a compact section heading.",
    initial: { ...base, variant: "underline", label: "Overview" },
  },
  {
    variant: "Content",
    description: "A label flanked by strokes, to break up a flowing list.",
    initial: { ...base, variant: "content", label: "More" },
  },
  {
    variant: "Vertical",
    description: "Divides content along the horizontal axis, typically inside a flex row.",
    initial: { ...base, orientation: "vertical" },
  },
  {
    variant: "Large label",
    description: "size sets the label text size on the labelled variants; the line ignores it.",
    initial: { ...base, variant: "content", size: "lg", label: "Large" },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet(props: SeparatorDemoProps): string {
  const { variant, size, orientation, label = "Section" } = props;
  const attrs = { variant, size, orientation };
  const defaults = { variant: "line", size: "md", orientation: "horizontal" };
  if (variant === "line")
    return jsxSnippet("Separator", { ...attrs, size: undefined }, { defaults });
  return jsxSnippet("Separator", attrs, { children: label, defaults });
}

export const story = defineStory({
  displayName: "Separator",
  Component: SeparatorDemo,
  args: presets,
});
