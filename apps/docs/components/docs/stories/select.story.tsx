import { type DocsStoryPreset, jsxSnippet } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { SelectDemo, type SelectDemoProps } from "./select-demo";

export const title = "Select";
// The controls are generated from `SelectDemoProps` when this file compiles.
// (Edit this file after changing that type, so the generated controls refresh.)

/** Arguments that shape the example and are not Select props: drawn in the "Demo" group. */
export const demoArgs = ["placeholder", "grouped"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  size: "md",
  disabled: false,
  placeholder: "Pick a framework",
  grouped: false,
} satisfies SelectDemoProps;

export const presets: DocsStoryPreset<SelectDemoProps>[] = [
  {
    variant: "Default",
    description: "A trigger that opens a list of options. Pick one to set the value.",
    initial: base,
  },
  {
    variant: "Small",
    description: "Sizes run from sm to lg and share the Button heights. Change size to compare.",
    initial: { ...base, size: "sm", placeholder: "Small" },
  },
  {
    variant: "Large",
    description: "The lg trigger, for forms with roomier controls.",
    initial: { ...base, size: "lg", placeholder: "Large" },
  },
  {
    variant: "Grouped",
    description:
      "Select.Group and Select.GroupLabel cluster related items; Select.Separator divides them.",
    initial: { ...base, grouped: true, placeholder: "Choose a tool" },
  },
  {
    variant: "Disabled",
    description: "The trigger does not open. Wrap it in a Field to add a label and validation.",
    initial: { ...base, disabled: true, placeholder: "Disabled" },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet(props: SelectDemoProps): string {
  const { size, disabled, placeholder = "Pick a framework", grouped } = props;
  const root = jsxSnippet(
    "Select.Root",
    { size, disabled },
    { openOnly: true, defaults: { size: "md" } },
  );
  const item = (indent: string, value: string, label: string) => [
    `${indent}<Select.Item value="${value}">`,
    `${indent}  <Select.ItemText>${label}</Select.ItemText>`,
    `${indent}  <Select.ItemIndicator />`,
    `${indent}</Select.Item>`,
  ];
  const items = grouped
    ? [
        "    <Select.Group>",
        "      <Select.GroupLabel>Frontend</Select.GroupLabel>",
        ...item("      ", "react", "React"),
        ...item("      ", "vue", "Vue"),
        "    </Select.Group>",
        "    <Select.Separator />",
        "    <Select.Group>",
        "      <Select.GroupLabel>Backend</Select.GroupLabel>",
        ...item("      ", "node", "Node.js"),
        ...item("      ", "deno", "Deno"),
        "    </Select.Group>",
      ]
    : [...item("    ", "react", "React"), ...item("    ", "vue", "Vue")];
  return [
    root,
    "  <Select.Trigger>",
    `    <Select.Value placeholder="${placeholder}" />`,
    "    <Select.Icon />",
    "  </Select.Trigger>",
    "  <Select.Popup>",
    ...items,
    "  </Select.Popup>",
    "</Select.Root>",
  ].join("\n");
}

export const story = defineStory({
  displayName: "Select",
  Component: SelectDemo,
  args: presets,
});
