import { type DocsStoryPreset, jsxSnippet, raw } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { ElevatedDemo, type ElevatedDemoProps } from "./elevated-demo";

export const title = "Elevated";
// The controls are generated from `ElevatedDemoProps` when this file compiles.
// (Edit this file after changing that type, so the generated controls refresh.)

/** Arguments that shape the example and are not Elevated props: drawn in the "Demo" group. */
export const demoArgs = ["nested"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Unset". */
const base = { level: 3, shadowLevel: 1, nested: true } satisfies ElevatedDemoProps;

/**
 * Presets are roles. Each sets `level` and `shadowLevel` to what the component for that role gets
 * on a level 1 page: its surface offset above the page (`SURFACE_OFFSET`) and its shadow level
 * (`SHADOW_LEVEL`). The numbers are what the role gets in one context, not rules for the role.
 */
export const presets: DocsStoryPreset<ElevatedDemoProps>[] = [
  {
    variant: "Card",
    description:
      "In-flow, grouped content. Two surface levels above the page, with the lightest shadow: level 3, shadow 1. A card inside it lands at level 5.",
    initial: base,
  },
  {
    variant: "Popover or menu",
    description:
      "Floats over the layout. The same surface offset as a card, so level 3, but a stronger shadow, 3, to lift it off what is behind. Menus and selects pair the same way.",
    initial: { ...base, shadowLevel: 3, nested: false },
  },
  {
    variant: "Toast",
    description:
      "Appears over everything, at the dialog offset: four levels above the page, level 5, with shadow 4.",
    initial: { ...base, level: 5, shadowLevel: 4, nested: false },
  },
  {
    variant: "Dialog",
    description:
      "Modal, on top of the page. Four surface levels above it, level 5, with shadow 5. Drawers and sheets pair the same way. Content inside lands at level 7.",
    initial: { ...base, level: 5, shadowLevel: 5 },
  },
  {
    variant: "Menubar or toolbar",
    description:
      "An inline bar, one surface level above its substrate: level 2 on the page, with shadow 1.",
    initial: { ...base, level: 2, nested: false },
  },
];

/** The JSX a reader would write for one preset. The surface level comes from context, so it is a comment. */
export function snippet(props: ElevatedDemoProps): string {
  const { level, shadowLevel, nested } = props;
  const root = jsxSnippet(
    "Elevated",
    { shadowLevel: shadowLevel !== 1 ? raw(String(shadowLevel)) : undefined },
    { openOnly: true },
  );
  return [
    `// Surface level ${level} here; in an app it comes from what the surface sits on, plus its offset.`,
    root,
    ...(nested ? ["  <Elevated>Nested, two levels above</Elevated>"] : ["  Content"]),
    "</Elevated>",
  ].join("\n");
}

export const story = defineStory({
  displayName: "Elevated",
  Component: ElevatedDemo,
  args: presets,
});
