import { type DocsStoryPreset, jsxSnippet, raw } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { ToggleGroupDemo, type ToggleGroupDemoProps } from "./toggle-group-demo";

export const title = "Toggle Group";

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  variant: "primary",
  size: "md",
  spacing: "joined",
  orientation: "horizontal",
  multiple: false,
  disabled: false,
} satisfies ToggleGroupDemoProps;

export const presets: DocsStoryPreset<ToggleGroupDemoProps>[] = [
  {
    variant: "Joined",
    description: "The default: items share one segmented track and one item is pressed.",
    initial: base,
  },
  {
    variant: "Gapped",
    description: "Spacing decides the track: gapped never draws it.",
    initial: { ...base, spacing: "gapped" },
  },
  {
    variant: "Ghost",
    description: "Transparent items with a family wash on hover.",
    initial: { ...base, variant: "ghost" },
  },
  {
    variant: "Small",
    description: "Sizes run from xs to lg. Items shrink inside the track by its inset.",
    initial: { ...base, size: "sm" },
  },
  {
    variant: "Icons",
    description:
      "An icon size (icon-xs, icon-sm, icon, icon-lg) makes every item a square icon-only toggle. Each needs an aria-label.",
    initial: { ...base, size: "icon-sm", multiple: true },
  },
  {
    variant: "Multiple",
    description: "More than one item can be pressed at a time.",
    initial: { ...base, multiple: true },
  },
  {
    variant: "Vertical",
    description: "Items stack. Arrow keys follow the orientation.",
    initial: { ...base, orientation: "vertical" },
  },
  {
    variant: "Disabled",
    description: "Every item is inert.",
    initial: { ...base, disabled: true },
  },
];

const ITEMS = ["Bold", "Italic", "Underline"];

/** The JSX a reader would write for one preset. */
export function snippet(props: ToggleGroupDemoProps): string {
  const defaultValue = props.multiple ? ["Bold", "Italic"] : ["Bold"];
  const open = jsxSnippet(
    "ToggleGroup",
    { ...props, defaultValue: raw(JSON.stringify(defaultValue)) },
    {
      defaults: { variant: "primary", size: "md", spacing: "joined", orientation: "horizontal" },
      openOnly: true,
    },
  );
  const items = props.size?.startsWith("icon")
    ? ITEMS.map(
        (item) =>
          `  <Toggle value="${item}" aria-label="${item}"><Text${item === "Bold" ? "B" : item} /></Toggle>`,
      )
    : ITEMS.map((item) => `  <Toggle value="${item}">${item}</Toggle>`);
  return [open, ...items, "</ToggleGroup>"].join("\n");
}

export const story = defineStory({
  displayName: "Toggle Group",
  Component: ToggleGroupDemo,
  args: presets,
});
