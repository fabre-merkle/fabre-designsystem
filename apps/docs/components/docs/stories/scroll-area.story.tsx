import { type DocsStoryPreset, jsxSnippet } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { ScrollAreaDemo, type ScrollAreaDemoProps } from "./scroll-area-demo";

export const title = "Scroll Area";
// The controls are generated from `ScrollAreaDemoProps` when this file compiles.
// (Edit this file after changing that type, so the generated controls refresh.)

/** Arguments that shape the example and are not ScrollArea props: drawn in the "Demo" group. */
export const demoArgs = ["axes"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  keepMounted: false,
  axes: "vertical",
} satisfies ScrollAreaDemoProps;

export const presets: DocsStoryPreset<ScrollAreaDemoProps>[] = [
  {
    variant: "Vertical",
    description: "The themed scrollbar appears on hover or while scrolling.",
    initial: base,
  },
  {
    variant: "Horizontal",
    description: "A second Scrollbar with orientation horizontal handles wide content.",
    initial: { ...base, axes: "horizontal" },
  },
  {
    variant: "Both axes",
    description: "Both scrollbars show, with a Corner where they meet.",
    initial: { ...base, axes: "both" },
  },
  {
    variant: "Keep mounted",
    description: "With keepMounted the scrollbar stays in the DOM even when nothing overflows.",
    initial: { ...base, keepMounted: true },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet({ keepMounted, axes }: ScrollAreaDemoProps): string {
  const vertical = axes !== "horizontal";
  const horizontal = axes !== "vertical";
  const bar = (orientation: "vertical" | "horizontal") => [
    `  ${jsxSnippet("ScrollArea.Scrollbar", { orientation, keepMounted }, { openOnly: true, defaults: { orientation: "vertical" } })}`,
    "    <ScrollArea.Thumb />",
    "  </ScrollArea.Scrollbar>",
  ];
  return [
    "<ScrollArea.Root style={{ height: 240 }}>",
    "  <ScrollArea.Viewport>",
    "    <ScrollArea.Content>{/* content */}</ScrollArea.Content>",
    "  </ScrollArea.Viewport>",
    ...(vertical ? bar("vertical") : []),
    ...(horizontal ? bar("horizontal") : []),
    ...(vertical && horizontal ? ["  <ScrollArea.Corner />"] : []),
    "</ScrollArea.Root>",
  ].join("\n");
}

export const story = defineStory({
  displayName: "Scroll Area",
  Component: ScrollAreaDemo,
  args: presets,
});
