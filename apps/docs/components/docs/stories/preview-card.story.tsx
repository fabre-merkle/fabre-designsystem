import { type DocsStoryPreset, jsxSnippet } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { PreviewCardDemo, type PreviewCardDemoProps } from "./preview-card-demo";

export const title = "Preview Card";
// The controls are generated from `PreviewCardDemoProps` when this file compiles.
// (Edit this file after changing that type, so the generated controls refresh.)

/** Arguments that shape the example and are not PreviewCard props: drawn in the "Demo" group. */
export const demoArgs = ["triggerLabel", "heading", "description", "showArrow"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  triggerLabel: "@acme",
  heading: "Acme",
  description: "A customer experience company.",
  showArrow: false,
  delay: 600,
  closeDelay: 300,
  side: "bottom",
  align: "center",
} satisfies PreviewCardDemoProps;

export const presets: DocsStoryPreset<PreviewCardDemoProps>[] = [
  {
    variant: "Default",
    description: "Hover or focus the link to preview its target. Touch users follow the link.",
    initial: base,
  },
  {
    variant: "With arrow",
    description: "PreviewCard.Arrow points at the trigger.",
    initial: { ...base, showArrow: true },
  },
  {
    variant: "Instant",
    description: "delay and closeDelay on PreviewCard.Trigger set to 0 open and close it at once.",
    initial: { ...base, delay: 0, closeDelay: 0 },
  },
  {
    variant: "Placement",
    description: "side and align on PreviewCard.Positioner pick where the card sits.",
    initial: { ...base, side: "right", align: "start" },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet(props: PreviewCardDemoProps): string {
  const {
    triggerLabel = "@acme",
    heading,
    description,
    showArrow,
    delay,
    closeDelay,
    side,
    align,
  } = props;
  const trigger = jsxSnippet(
    "PreviewCard.Trigger",
    { href: "/acme", delay, closeDelay },
    { openOnly: true, defaults: { delay: 600, closeDelay: 300 } },
  );
  const positioner = jsxSnippet(
    "PreviewCard.Positioner",
    { side, align },
    { openOnly: true, defaults: { side: "bottom", align: "center" } },
  );
  return [
    "<PreviewCard.Root>",
    `  ${trigger}${triggerLabel}</PreviewCard.Trigger>`,
    "  <PreviewCard.Portal>",
    `    ${positioner}`,
    "      <PreviewCard.Popup>",
    ...(showArrow ? ["        <PreviewCard.Arrow />"] : []),
    `        <strong>${heading}</strong>`,
    `        <span>${description}</span>`,
    "      </PreviewCard.Popup>",
    "    </PreviewCard.Positioner>",
    "  </PreviewCard.Portal>",
    "</PreviewCard.Root>",
  ].join("\n");
}

export const story = defineStory({
  displayName: "PreviewCard",
  Component: PreviewCardDemo,
  args: presets,
});
