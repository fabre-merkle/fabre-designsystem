import { type DocsStoryPreset, jsxSnippet } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { MeterDemo, type MeterDemoProps } from "./meter-demo";

export const title = "Meter";
// The controls are generated from `MeterDemoProps` when this file compiles.
// (Edit this file after changing that type, so the generated controls refresh.)

/** Arguments that shape the example and are not Meter props: drawn in the "Demo" group. */
export const demoArgs = ["label"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  size: "md",
  tone: "neutral",
  value: 64,
  label: "Storage used",
} satisfies MeterDemoProps;

export const presets: DocsStoryPreset<MeterDemoProps>[] = [
  {
    variant: "Neutral",
    description: "The default tone. You decide which range maps to which tone.",
    initial: base,
  },
  {
    variant: "Success",
    description: "A healthy reading.",
    initial: { ...base, tone: "success", value: 55, label: "Good" },
  },
  {
    variant: "Warning",
    description: "Approaching a limit.",
    initial: { ...base, tone: "warning", value: 78, label: "Approaching limit" },
  },
  {
    variant: "Critical",
    description: "Past the threshold, such as nearly full storage.",
    initial: { ...base, tone: "critical", value: 94, label: "Almost full" },
  },
  {
    variant: "Large",
    description: "Track heights run sm 4px, md 8px, lg 12px. Change size to compare.",
    initial: { ...base, size: "lg" },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet(props: MeterDemoProps): string {
  const { size, tone, value = 64, label = "Storage used" } = props;
  const root = jsxSnippet(
    "Meter.Root",
    { size, tone, value },
    { openOnly: true, defaults: { size: "md", tone: "neutral" } },
  );
  return [
    root,
    `  <Meter.Label>${label}</Meter.Label>`,
    "  <Meter.Value />",
    "  <Meter.Track>",
    "    <Meter.Indicator />",
    "  </Meter.Track>",
    "</Meter.Root>",
  ].join("\n");
}

export const story = defineStory({
  displayName: "Meter",
  Component: MeterDemo,
  args: presets,
});
