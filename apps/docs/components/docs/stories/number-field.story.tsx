import { type DocsStoryPreset, jsxSnippet } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { NumberFieldDemo, type NumberFieldDemoProps } from "./number-field-demo";

export const title = "Number Field";

/** Arguments that shape the example and are not NumberField props: drawn in the "Demo" group. */
export const demoArgs = ["scrubArea"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  size: "md",
  disabled: false,
  invalid: false,
  step: 1,
  defaultValue: 4,
  scrubArea: false,
} satisfies NumberFieldDemoProps;

export const presets: DocsStoryPreset<NumberFieldDemoProps>[] = [
  {
    variant: "Default",
    description: "Type a value, use the steppers, or press the arrow keys.",
    initial: base,
  },
  {
    variant: "Small",
    description: "Sizes run from sm to lg and share the Button heights.",
    initial: { ...base, size: "sm" },
  },
  {
    variant: "Large",
    description: "A taller group with larger text.",
    initial: { ...base, size: "lg" },
  },
  {
    variant: "Range",
    description: "min, max and step constrain the value. A stepper disables at its bound.",
    initial: { ...base, min: 0, max: 100, step: 5, defaultValue: 50 },
  },
  {
    variant: "Scrub area",
    description: "Drag the label to adjust the value. The pointer locks while scrubbing.",
    initial: { ...base, defaultValue: 10, scrubArea: true },
  },
  {
    variant: "Invalid",
    description: "The group takes the error border and outline.",
    initial: { ...base, invalid: true },
  },
  {
    variant: "Disabled",
    description: "Not interactive and not focusable.",
    initial: { ...base, disabled: true },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet({ scrubArea, ...props }: NumberFieldDemoProps): string {
  const open = jsxSnippet("NumberField.Root", props, {
    defaults: { size: "md", step: 1 },
    openOnly: true,
  });
  return [
    open,
    ...(scrubArea
      ? [
          "  <NumberField.ScrubArea>",
          "    Quantity",
          "    <NumberField.ScrubAreaCursor />",
          "  </NumberField.ScrubArea>",
        ]
      : []),
    "  <NumberField.Group>",
    '    <NumberField.Decrement aria-label="Decrease">−</NumberField.Decrement>',
    '    <NumberField.Input aria-label="Quantity" />',
    '    <NumberField.Increment aria-label="Increase">+</NumberField.Increment>',
    "  </NumberField.Group>",
    "</NumberField.Root>",
  ].join("\n");
}

export const story = defineStory({
  displayName: "Number Field",
  Component: NumberFieldDemo,
  args: presets,
});
