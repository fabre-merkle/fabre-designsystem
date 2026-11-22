import { type DocsStoryPreset, jsxSnippet, raw } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { SliderDemo, type SliderDemoProps } from "./slider-demo";

export const title = "Slider";

/** Arguments that shape the example and are not Slider props: drawn in the "Demo" group. */
export const demoArgs = ["range", "showValue"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  size: "md",
  disabled: false,
  min: 0,
  max: 100,
  step: 1,
  range: false,
  showValue: true,
} satisfies SliderDemoProps;

export const presets: DocsStoryPreset<SliderDemoProps>[] = [
  {
    variant: "Single value",
    description: "One thumb. Arrow keys move it by step, Page Up and Page Down by ten steps.",
    initial: base,
  },
  {
    variant: "Range",
    description: "Pass an array defaultValue to render two thumbs and select a range.",
    initial: { ...base, range: true },
  },
  {
    variant: "Small",
    description: "Sizes run from sm to lg. The size reaches every part through context.",
    initial: { ...base, size: "sm" },
  },
  {
    variant: "Large",
    description: "A larger track and thumb.",
    initial: { ...base, size: "lg" },
  },
  {
    variant: "Stepped",
    description: "The value snaps to multiples of step.",
    initial: { ...base, step: 10 },
  },
  {
    variant: "Disabled",
    description: "Not interactive and not focusable.",
    initial: { ...base, disabled: true },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet({ range, showValue, ...props }: SliderDemoProps): string {
  const open = jsxSnippet(
    "Slider.Root",
    { ...props, defaultValue: range ? raw("[20, 80]") : 40 },
    { defaults: { size: "md", min: 0, max: 100, step: 1 }, openOnly: true },
  );
  const thumbs = range
    ? [
        '      <Slider.Thumb index={0} aria-label="Minimum" />',
        '      <Slider.Thumb index={1} aria-label="Maximum" />',
      ]
    : ['      <Slider.Thumb aria-label="Volume" />'];
  return [
    open,
    ...(showValue ? ["  <Slider.Value />"] : []),
    "  <Slider.Control>",
    "    <Slider.Track>",
    "      <Slider.Indicator />",
    ...thumbs,
    "    </Slider.Track>",
    "  </Slider.Control>",
    "</Slider.Root>",
  ].join("\n");
}

export const story = defineStory({
  displayName: "Slider",
  Component: SliderDemo,
  args: presets,
});
