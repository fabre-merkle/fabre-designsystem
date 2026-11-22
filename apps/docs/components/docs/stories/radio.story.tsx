import { type DocsStoryPreset, jsxSnippet } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { RadioDemo, type RadioDemoProps } from "./radio-demo";

export const title = "Radio";
// The controls are generated from `RadioDemoProps` when this file compiles.
// (Edit this file after changing that type, so the generated controls refresh.)

/** Arguments that shape the example and are not Radio props: drawn in the "Demo" group. */
export const demoArgs = ["selected"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  disabled: false,
  readOnly: false,
  required: false,
  selected: "monthly",
} satisfies RadioDemoProps;

export const presets: DocsStoryPreset<RadioDemoProps>[] = [
  {
    variant: "Selected",
    description: "The group's value picks the selected radio. Arrow keys move the selection.",
    initial: base,
  },
  {
    variant: "Unselected",
    description: "With no value in the group, no radio is selected.",
    initial: { ...base, selected: "none" },
  },
  {
    variant: "Disabled",
    description: "The second radio is inert while the rest of the group stays live.",
    initial: { ...base, disabled: true },
  },
  {
    variant: "Read only",
    description: "The radio can be read and focused, but it cannot be chosen.",
    initial: { ...base, readOnly: true },
  },
  {
    variant: "Required",
    description: "The group needs a choice before a form can submit.",
    initial: { ...base, required: true, selected: "none" },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet({ disabled, readOnly, required, selected }: RadioDemoProps): string {
  const open = jsxSnippet(
    "RadioGroup",
    { defaultValue: selected === "none" ? undefined : selected },
    { openOnly: true },
  );
  return [
    open,
    "  <label>",
    '    <Radio value="monthly" /> Monthly',
    "  </label>",
    "  <label>",
    `    ${jsxSnippet("Radio", { value: "yearly", disabled, readOnly, required })} Yearly`,
    "  </label>",
    "</RadioGroup>",
  ].join("\n");
}

export const story = defineStory({
  displayName: "Radio",
  Component: RadioDemo,
  args: presets,
});
