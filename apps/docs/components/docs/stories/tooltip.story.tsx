import { type DocsStoryPreset, jsxSnippet } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { TooltipDemo, type TooltipDemoProps } from "./tooltip-demo";

export const title = "Tooltip";
// The controls are generated from `TooltipDemoProps` when this file compiles.
// (Edit this file after changing that type, so the generated controls refresh.)

/** Arguments that shape the example and are not Tooltip props: drawn in the "Demo" group. */
export const demoArgs = ["triggerLabel", "content", "showArrow"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  triggerLabel: "Hover me",
  content: "Saves your changes immediately",
  showArrow: false,
  disabled: false,
  side: "top",
  align: "center",
  delay: 600,
  trackCursorAxis: "none",
} satisfies TooltipDemoProps;

export const presets: DocsStoryPreset<TooltipDemoProps>[] = [
  {
    variant: "Default",
    description: "Opens on hover or keyboard focus after a short delay, and closes on Escape.",
    initial: base,
  },
  {
    variant: "With arrow",
    description: "Tooltip.Arrow points at the trigger.",
    initial: { ...base, showArrow: true },
  },
  {
    variant: "Placement",
    description: "side and align on Tooltip.Positioner pick where the tooltip sits.",
    initial: { ...base, side: "right", align: "center", triggerLabel: "Hover for the right side" },
  },
  {
    variant: "Instant",
    description: "delay on Tooltip.Provider set to 0 opens it as soon as the pointer arrives.",
    initial: { ...base, delay: 0 },
  },
  {
    variant: "Follows the cursor",
    description: "trackCursorAxis on Tooltip.Root lets the tooltip follow the pointer.",
    initial: { ...base, trackCursorAxis: "both", triggerLabel: "Move across me" },
  },
  {
    variant: "Disabled",
    description: "disabled on Tooltip.Root stops it from opening.",
    initial: { ...base, disabled: true },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet(props: TooltipDemoProps): string {
  const {
    triggerLabel = "Hover me",
    content,
    showArrow,
    disabled,
    side,
    align,
    delay,
    trackCursorAxis,
  } = props;
  const provider = jsxSnippet(
    "Tooltip.Provider",
    { delay },
    { openOnly: true, defaults: { delay: 600 } },
  );
  const root = jsxSnippet(
    "Tooltip.Root",
    { disabled, trackCursorAxis },
    { openOnly: true, defaults: { trackCursorAxis: "none" } },
  );
  const positioner = jsxSnippet(
    "Tooltip.Positioner",
    { side, align },
    { openOnly: true, defaults: { side: "top", align: "center" } },
  );
  return [
    provider,
    `  ${root}`,
    `    <Tooltip.Trigger render={<Button>${triggerLabel}</Button>} />`,
    "    <Tooltip.Portal>",
    `      ${positioner}`,
    "        <Tooltip.Popup>",
    ...(showArrow ? ["          <Tooltip.Arrow />"] : []),
    `          ${content}`,
    "        </Tooltip.Popup>",
    "      </Tooltip.Positioner>",
    "    </Tooltip.Portal>",
    "  </Tooltip.Root>",
    "</Tooltip.Provider>",
  ].join("\n");
}

export const story = defineStory({
  displayName: "Tooltip",
  Component: TooltipDemo,
  args: presets,
});
