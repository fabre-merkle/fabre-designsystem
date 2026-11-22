import { type DocsStoryPreset, jsxSnippet } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { CollapsibleDemo, type CollapsibleDemoProps } from "./collapsible-demo";

export const title = "Collapsible";
// The controls are generated from `CollapsibleDemoProps` when this file compiles.
// (Edit this file after changing that type, so the generated controls refresh.)

/** Arguments that shape the example and are not Collapsible props: drawn in the "Demo" group. */
export const demoArgs = ["hiddenUntilFound"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  defaultOpen: false,
  disabled: false,
  hiddenUntilFound: false,
} satisfies CollapsibleDemoProps;

export const presets: DocsStoryPreset<CollapsibleDemoProps>[] = [
  {
    variant: "Closed",
    description: "The panel starts closed. Activate the trigger to reveal it.",
    initial: base,
  },
  {
    variant: "Open",
    description: "With defaultOpen, the panel starts open.",
    initial: { ...base, defaultOpen: true },
  },
  {
    variant: "Disabled",
    description: "The trigger is inert and the panel keeps its state.",
    initial: { ...base, disabled: true },
  },
  {
    variant: "Find in page",
    description:
      "With hiddenUntilFound on the panel, the browser's find-in-page opens it when the text matches.",
    initial: { ...base, hiddenUntilFound: true },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet({ defaultOpen, disabled, hiddenUntilFound }: CollapsibleDemoProps): string {
  return [
    jsxSnippet("Collapsible.Root", { defaultOpen, disabled }, { openOnly: true }),
    '  <Collapsible.Trigger render={<Button variant="secondary">Toggle details</Button>} />',
    `  ${jsxSnippet("Collapsible.Panel", { hiddenUntilFound }, { openOnly: true })}`,
    "    Hidden content revealed on open.",
    "  </Collapsible.Panel>",
    "</Collapsible.Root>",
  ].join("\n");
}

export const story = defineStory({
  displayName: "Collapsible",
  Component: CollapsibleDemo,
  args: presets,
});
