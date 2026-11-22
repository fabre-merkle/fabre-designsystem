import { type DocsStoryPreset, jsxSnippet, raw } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { CardDemo, type CardDemoPresetOnly, type CardDemoProps } from "./card-demo";

export const title = "Card";
// The controls are generated from `CardDemoProps` when this file compiles.
// (Edit this file after changing that type, so the generated controls refresh: sizes sm, md, lg.)

/** Arguments that shape the example and are not Card props: drawn in the "Demo" group. */
export const demoArgs = ["nested", "title", "description"] as const;

type Args = CardDemoProps & CardDemoPresetOnly;

/** Every control has a value, so the panel shows the real setting instead of "Unset". */
const base = {
  size: "md",
  shadowLevel: 1,
  level: 3,
  nested: true,
  title: "Project settings",
  description: "Name, visibility and members.",
} satisfies CardDemoProps;

export const presets: DocsStoryPreset<Args>[] = [
  {
    variant: "Default",
    description:
      "A card with a card inside. On the page the card is surface level 3 with shadow level 1, and the nested card lands at level 5 with its own shadow level of 1.",
    initial: base,
  },
  {
    variant: "Single card",
    description: "Without a nested card.",
    initial: { ...base, nested: false },
  },
  {
    variant: "Small",
    description: "Tighter padding and gap for dense grids. The type does not change.",
    initial: { ...base, size: "sm", nested: false },
  },
  {
    variant: "Large",
    description:
      "More padding and gap for a standalone or hero card that needs room. The type does not change.",
    initial: { ...base, size: "lg", nested: false },
  },
  {
    variant: "With action",
    description: "The action sits beside the title and description, in the header.",
    initial: { ...base, nested: false, showAction: true },
  },
  {
    variant: "With footer",
    description: "Footer items sit in a row, aligned to the start.",
    initial: { ...base, nested: false, showFooter: true },
  },
];

/** The JSX a reader would write for one preset. The surface level comes from context, so it is a comment, not a prop. */
export function snippet(props: Args): string {
  const {
    size,
    level,
    shadowLevel,
    title = "",
    description = "",
    nested,
    showAction,
    showFooter,
  } = props;
  const root = jsxSnippet(
    "Card.Root",
    { size, shadowLevel: shadowLevel !== 1 ? raw(String(shadowLevel)) : undefined },
    { openOnly: true, defaults: { size: "md" } },
  );
  return [
    `// Surface level ${level} here; in an app it comes from what the card sits on.`,
    root,
    "  <Card.Header>",
    `    <Card.Title>${title}</Card.Title>`,
    `    <Card.Description>${description}</Card.Description>`,
    ...(showAction
      ? [
          "    <Card.Action>",
          '      <Button size="sm" variant="secondary" mode="ghost">Edit</Button>',
          "    </Card.Action>",
        ]
      : []),
    "  </Card.Header>",
    "  <Card.Content>",
    ...(nested
      ? [
          '    <Card.Root size="sm">',
          "      <Card.Header>",
          "        <Card.Title>Nested card</Card.Title>",
          "        <Card.Description>Raised on its own, no props.</Card.Description>",
          "      </Card.Header>",
          "    </Card.Root>",
        ]
      : ["    Changes apply to everyone who can open this project."]),
    "  </Card.Content>",
    ...(showFooter
      ? [
          "  <Card.Footer>",
          '    <Button size="sm" variant="secondary" mode="ghost">Cancel</Button>',
          '    <Button size="sm">Save</Button>',
          "  </Card.Footer>",
        ]
      : []),
    "</Card.Root>",
  ].join("\n");
}

export const story = defineStory({
  displayName: "Card",
  Component: CardDemo,
  args: presets,
});
