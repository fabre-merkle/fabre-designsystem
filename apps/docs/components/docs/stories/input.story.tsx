import { type DocsStoryPreset, jsxSnippet } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { InputDemo, type InputDemoProps } from "./input-demo";

export const title = "Input";

/** Arguments that shape the example and are not Input props: drawn in the "Demo" group. */
export const demoArgs = ["invalid"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  size: "md",
  disabled: false,
  readOnly: false,
  placeholder: "you@example.com",
  defaultValue: "",
  invalid: false,
} satisfies InputDemoProps;

export const presets: DocsStoryPreset<InputDemoProps>[] = [
  {
    variant: "Default",
    description: "The field rests on the recessed surface. Keyboard focus adds the control border.",
    initial: base,
  },
  {
    variant: "Small",
    description: "Sizes run from sm to lg and sit flush beside a Button of the same size.",
    initial: { ...base, size: "sm" },
  },
  {
    variant: "Large",
    description: "A taller field with larger text.",
    initial: { ...base, size: "lg" },
  },
  {
    variant: "With value",
    description: "A filled field.",
    initial: { ...base, defaultValue: "ada@example.com" },
  },
  {
    variant: "Invalid",
    description: "The error border and outline. Inside a Field, its invalid state drives this.",
    initial: { ...base, defaultValue: "ada@", invalid: true },
  },
  {
    variant: "Disabled",
    description: "Not interactive and not focusable.",
    initial: { ...base, disabled: true },
  },
  {
    variant: "Read only",
    description: "Focusable and selectable, but the text cannot change.",
    initial: { ...base, readOnly: true, defaultValue: "ada@example.com" },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet({ invalid, defaultValue, ...props }: InputDemoProps): string {
  return jsxSnippet(
    "Input",
    {
      ...props,
      "aria-label": "Email",
      defaultValue: defaultValue || undefined,
      "aria-invalid": invalid,
    },
    { defaults: { size: "md" } },
  );
}

export const story = defineStory({
  displayName: "Input",
  Component: InputDemo,
  args: presets,
});
