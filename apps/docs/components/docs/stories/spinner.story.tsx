import { type DocsStoryPreset, jsxSnippet } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { SpinnerDemo, type SpinnerDemoProps } from "./spinner-demo";

export const title = "Spinner";
// The controls are generated from `SpinnerDemoProps` when this file compiles.
// (Edit this file after changing that type, so the generated controls refresh.)

/** Arguments that shape the example and are not Spinner props: drawn in the "Demo" group. */
export const demoArgs = ["inButton", "showAllSizes"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  size: "md",
  tone: "current",
  label: "Loading",
  inButton: false,
  showAllSizes: false,
} satisfies SpinnerDemoProps;

export const presets: DocsStoryPreset<SpinnerDemoProps>[] = [
  {
    variant: "Default",
    description: "The arc follows the surrounding text colour.",
    initial: base,
  },
  {
    variant: "Brand",
    description: "The brand ink, theme-aware, for standalone loading states.",
    initial: { ...base, size: "lg", tone: "brand" },
  },
  {
    variant: "All sizes",
    description: "Sizes follow the control icon scale: xs, sm, md, lg.",
    initial: { ...base, showAllSizes: true },
  },
  {
    variant: "In a button",
    description: "An xs spinner stands in for an icon while the button is busy.",
    initial: { ...base, inButton: true, label: "Saving" },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet(props: SpinnerDemoProps): string {
  const { size, tone, label = "Loading", inButton } = props;
  if (inButton) {
    return [
      '<Button variant="primary" disabled>',
      `  <Spinner size="xs" label="${label}" />`,
      "  Saving",
      "</Button>",
    ].join("\n");
  }
  return jsxSnippet(
    "Spinner",
    { size, tone, label },
    { defaults: { size: "md", tone: "current" } },
  );
}

export const story = defineStory({
  displayName: "Spinner",
  Component: SpinnerDemo,
  args: presets,
});
