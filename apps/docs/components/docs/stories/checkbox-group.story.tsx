import { type DocsStoryPreset, jsxSnippet, raw } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { CheckboxGroupDemo, type CheckboxGroupDemoProps } from "./checkbox-group-demo";

export const title = "Checkbox Group";
// The controls are generated from `CheckboxGroupDemoProps` when this file compiles.
// (Edit this file after changing that type, so the generated controls refresh.)

/** Arguments that shape the example and are not CheckboxGroup props: drawn in the "Demo" group. */
export const demoArgs = ["selected", "showParent"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  disabled: false,
  selected: "some",
  showParent: false,
} satisfies CheckboxGroupDemoProps;

export const presets: DocsStoryPreset<CheckboxGroupDemoProps>[] = [
  {
    variant: "Default",
    description: "One checkbox is checked. The group's value is the array of checked names.",
    initial: base,
  },
  {
    variant: "None checked",
    description: "An empty value: nothing is checked at first.",
    initial: { ...base, selected: "none" },
  },
  {
    variant: "All checked",
    description: "Every name is in the value.",
    initial: { ...base, selected: "all" },
  },
  {
    variant: "With parent",
    description:
      "Pass allValues and a parent Checkbox: the parent is checked, cleared or indeterminate to match the set.",
    initial: { ...base, showParent: true },
  },
  {
    variant: "Disabled",
    description: "Every checkbox in the group is inert.",
    initial: { ...base, disabled: true },
  },
];

const OPTIONS = [
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "push", label: "Push" },
] as const;

/** The JSX a reader would write for one preset. */
export function snippet({ disabled, selected, showParent }: CheckboxGroupDemoProps): string {
  const checked =
    selected === "all" ? ["email", "sms", "push"] : selected === "some" ? ["email"] : [];
  const open = jsxSnippet(
    "CheckboxGroup",
    {
      defaultValue: raw(JSON.stringify(checked)),
      allValues: showParent ? raw('["email", "sms", "push"]') : undefined,
      disabled,
    },
    { openOnly: true },
  );
  const parent = showParent
    ? ["  <label>", "    <Checkbox parent /> All channels", "  </label>"]
    : [];
  const items = OPTIONS.flatMap(({ value, label }) => [
    "  <label>",
    `    ${jsxSnippet("Checkbox", { name: value })} ${label}`,
    "  </label>",
  ]);
  return [open, ...parent, ...items, "</CheckboxGroup>"].join("\n");
}

export const story = defineStory({
  displayName: "Checkbox Group",
  Component: CheckboxGroupDemo,
  args: presets,
});
