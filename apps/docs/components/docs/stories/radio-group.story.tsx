import { type DocsStoryPreset, jsxSnippet } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { RadioGroupDemo, type RadioGroupDemoProps } from "./radio-group-demo";

export const title = "Radio Group";

/** Arguments that shape the example and are not RadioGroup props: drawn in the "Demo" group. */
export const demoArgs = ["disabledOption"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  defaultValue: "email",
  disabled: false,
  readOnly: false,
  required: false,
  disabledOption: false,
} satisfies RadioGroupDemoProps;

export const presets: DocsStoryPreset<RadioGroupDemoProps>[] = [
  {
    variant: "Default",
    description: "One option is selected. Arrow keys move the selection.",
    initial: base,
  },
  {
    variant: "Another selection",
    description: "Change defaultValue to start on a different option.",
    initial: { ...base, defaultValue: "sms" },
  },
  {
    variant: "Disabled option",
    description: "One radio is inert while the rest of the group stays live.",
    initial: { ...base, disabledOption: true },
  },
  {
    variant: "Disabled",
    description: "Every option is inert.",
    initial: { ...base, disabled: true },
  },
  {
    variant: "Read only",
    description: "The selection can be read and focused but not changed.",
    initial: { ...base, readOnly: true },
  },
  {
    variant: "Required",
    description: "An option must be chosen before a form can submit.",
    initial: { ...base, required: true },
  },
];

const OPTIONS = [
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "push", label: "Push" },
] as const;

/** The JSX a reader would write for one preset. */
export function snippet({ disabledOption, ...props }: RadioGroupDemoProps): string {
  const open = jsxSnippet("RadioGroup", props, { openOnly: true });
  const items = OPTIONS.map(({ value, label }) => {
    const radio = jsxSnippet("Radio", {
      value,
      disabled: disabledOption && value === "push",
    });
    return `  <label>\n    ${radio} ${label}\n  </label>`;
  });
  return [open, ...items, "</RadioGroup>"].join("\n");
}

export const story = defineStory({
  displayName: "Radio Group",
  Component: RadioGroupDemo,
  args: presets,
});
