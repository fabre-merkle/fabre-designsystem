import { type DocsStoryPreset, jsxSnippet } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { AccordionDemo, type AccordionDemoProps } from "./accordion-demo";

export const title = "Accordion";
// The controls are generated from `AccordionDemoProps` when this file compiles.
// (Edit this file after changing that type, so the generated controls refresh.)

/** Arguments that shape the example and are not Accordion props: drawn in the "Demo" group. */
export const demoArgs = ["disableLastItem"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  multiple: false,
  disabled: false,
  disableLastItem: false,
} satisfies AccordionDemoProps;

export const presets: DocsStoryPreset<AccordionDemoProps>[] = [
  {
    variant: "Single",
    description: "One panel open at a time. Opening another closes the first.",
    initial: base,
  },
  {
    variant: "Multiple",
    description: "With multiple, any number of panels stay open.",
    initial: { ...base, multiple: true },
  },
  {
    variant: "Disabled item",
    description: "A disabled item cannot be toggled; set disabled on the root to lock them all.",
    initial: { ...base, disableLastItem: true },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet(props: AccordionDemoProps): string {
  const { multiple, disabled, disableLastItem } = props;
  const root = jsxSnippet("Accordion.Root", { multiple, disabled }, { openOnly: true });
  const item = (value: string, label: string, off: boolean) => [
    `  ${jsxSnippet("Accordion.Item", { value, disabled: off }, { openOnly: true })}`,
    "    <Accordion.Header>",
    `      <Accordion.Trigger>${label}</Accordion.Trigger>`,
    "    </Accordion.Header>",
    "    <Accordion.Panel>…</Accordion.Panel>",
    "  </Accordion.Item>",
  ];
  return [
    root,
    ...item("overview", "Overview", false),
    ...item("settings", "Settings", Boolean(disableLastItem)),
    "</Accordion.Root>",
  ].join("\n");
}

export const story = defineStory({
  displayName: "Accordion",
  Component: AccordionDemo,
  args: presets,
});
