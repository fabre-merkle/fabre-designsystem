import { type DocsStoryPreset, jsxSnippet, raw } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { ProgressDemo, type ProgressDemoProps } from "./progress-demo";

export const title = "Progress";
// The controls are generated from `ProgressDemoProps` when this file compiles.
// (Edit this file after changing that type, so the generated controls refresh.)

/** Arguments that shape the example and are not Progress props: drawn in the "Demo" group. */
export const demoArgs = ["indeterminate", "label", "showValue"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  size: "md",
  value: 60,
  indeterminate: false,
  label: "Uploading",
  showValue: true,
} satisfies ProgressDemoProps;

export const presets: DocsStoryPreset<ProgressDemoProps>[] = [
  {
    variant: "In progress",
    description: "A determinate bar. The indicator fills to the value.",
    initial: base,
  },
  {
    variant: "Complete",
    description:
      "At 100 the status becomes complete and the indicator shifts to the success colour.",
    initial: { ...base, value: 100, label: "Complete" },
  },
  {
    variant: "Indeterminate",
    description: "No value: a 40% strip animates across the track. Pass value={null}.",
    initial: { ...base, indeterminate: true, label: "Working" },
  },
  {
    variant: "Small",
    description: "Track heights run sm 4px, md 8px, lg 12px. Change size to compare.",
    initial: { ...base, size: "sm", value: 45 },
  },
  {
    variant: "Large",
    description: "The lg track.",
    initial: { ...base, size: "lg", value: 45 },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet(props: ProgressDemoProps): string {
  const { size, value = 60, indeterminate, label = "Uploading", showValue } = props;
  const root = jsxSnippet(
    "Progress.Root",
    { size, value: indeterminate ? raw("null") : value },
    { openOnly: true, defaults: { size: "md" } },
  );
  return [
    root,
    `  <Progress.Label>${label}</Progress.Label>`,
    ...(showValue && !indeterminate ? ["  <Progress.Value />"] : []),
    "  <Progress.Track>",
    "    <Progress.Indicator />",
    "  </Progress.Track>",
    "</Progress.Root>",
  ].join("\n");
}

export const story = defineStory({
  displayName: "Progress",
  Component: ProgressDemo,
  args: presets,
});
