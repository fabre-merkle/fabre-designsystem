import { type DocsStoryPreset, jsxSnippet } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { SwitchDemo, type SwitchDemoProps } from "./switch-demo";

export const title = "Switch";

/** Arguments that shape the example and are not Switch props: drawn in the "Demo" group. */
export const demoArgs = ["label"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  defaultChecked: true,
  disabled: false,
  readOnly: false,
  required: false,
  label: "Email notifications",
} satisfies SwitchDemoProps;

export const presets: DocsStoryPreset<SwitchDemoProps>[] = [
  {
    variant: "On",
    description: "Checked. Press Space or click to turn it off.",
    initial: base,
  },
  {
    variant: "Off",
    description: "Unchecked, the default.",
    initial: { ...base, defaultChecked: false },
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
    description: "Must be on before a form can submit.",
    initial: { ...base, defaultChecked: false, required: true },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet({ label = "Email notifications", ...props }: SwitchDemoProps): string {
  return ["<label>", `  ${jsxSnippet("Switch", props)}`, `  ${label}`, "</label>"].join("\n");
}

export const story = defineStory({
  displayName: "Switch",
  Component: SwitchDemo,
  args: presets,
});
