import { type DocsStoryPreset, jsxSnippet } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { CheckboxDemo, type CheckboxDemoProps } from "./checkbox-demo";

export const title = "Checkbox";

/** Arguments that shape the example and are not Checkbox props: drawn in the "Demo" group. */
export const demoArgs = ["label"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  defaultChecked: true,
  indeterminate: false,
  disabled: false,
  readOnly: false,
  required: false,
  label: "Accept the terms",
} satisfies CheckboxDemoProps;

export const presets: DocsStoryPreset<CheckboxDemoProps>[] = [
  {
    variant: "Checked",
    description: "Checked. Press Space or click to clear it.",
    initial: base,
  },
  {
    variant: "Unchecked",
    description: "Unchecked, the default.",
    initial: { ...base, defaultChecked: false },
  },
  {
    variant: "Indeterminate",
    description: "Neither checked nor unchecked, for a parent of a partly selected set.",
    initial: { ...base, defaultChecked: false, indeterminate: true },
  },
  {
    variant: "Disabled",
    description: "Not interactive and not submitted with a form.",
    initial: { ...base, disabled: true },
  },
  {
    variant: "Read only",
    description: "Focusable, but the value cannot change.",
    initial: { ...base, readOnly: true },
  },
  {
    variant: "Required",
    description: "Must be checked before a form can submit.",
    initial: { ...base, defaultChecked: false, required: true },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet({ label = "Accept the terms", ...props }: CheckboxDemoProps): string {
  return ["<label>", `  ${jsxSnippet("Checkbox", props)}`, `  ${label}`, "</label>"].join("\n");
}

export const story = defineStory({
  displayName: "Checkbox",
  Component: CheckboxDemo,
  args: presets,
});
