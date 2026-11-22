import { type DocsStoryPreset, jsxSnippet, raw } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { PopoverDemo, type PopoverDemoProps } from "./popover-demo";

export const title = "Popover";
// The controls are generated from `PopoverDemoProps` when this file compiles.
// (Edit this file after changing that type, so the generated controls refresh.)

/** Arguments that shape the example and are not Popover props: drawn in the "Demo" group. */
export const demoArgs = ["triggerLabel", "title", "description", "showArrow", "showClose"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  triggerLabel: "Show details",
  title: "Account status",
  description: "Your account is in good standing. Renewal is automatic on the first of each month.",
  showArrow: false,
  showClose: false,
  openOnHover: false,
  modal: false,
  side: "bottom",
  align: "center",
  sideOffset: 8,
} satisfies PopoverDemoProps;

export const presets: DocsStoryPreset<PopoverDemoProps>[] = [
  {
    variant: "Default",
    description: "Opens on click below the trigger. Focus moves in and Escape closes it.",
    initial: base,
  },
  {
    variant: "With arrow",
    description: "Popover.Arrow points at the trigger.",
    initial: { ...base, showArrow: true },
  },
  {
    variant: "Placement",
    description: "side and align on Popover.Positioner pick where the popup sits.",
    initial: { ...base, side: "right", align: "start", triggerLabel: "Show on the right" },
  },
  {
    variant: "Open on hover",
    description: "openOnHover on Popover.Trigger opens it on hover; a click still works.",
    initial: { ...base, openOnHover: true, triggerLabel: "Hover or click" },
  },
  {
    variant: "Modal",
    description: "The page behind is inert while the popover is open.",
    initial: { ...base, modal: true, showClose: true, triggerLabel: "Open modal popover" },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet(props: PopoverDemoProps): string {
  const {
    triggerLabel = "Show details",
    title,
    description,
    showArrow,
    showClose,
    openOnHover,
    modal,
    side,
    align,
    sideOffset,
  } = props;
  const root = jsxSnippet("Popover.Root", { modal }, { openOnly: true });
  const trigger = jsxSnippet(
    "Popover.Trigger",
    {
      openOnHover,
      render: raw(`<Button variant="secondary">${triggerLabel}</Button>`),
    },
    {},
  );
  const positioner = jsxSnippet(
    "Popover.Positioner",
    { side, align, sideOffset },
    { openOnly: true, defaults: { side: "bottom", align: "center", sideOffset: 8 } },
  );
  return [
    root,
    `  ${trigger}`,
    "  <Popover.Portal>",
    `    ${positioner}`,
    "      <Popover.Popup>",
    ...(showArrow ? ["        <Popover.Arrow />"] : []),
    `        <Popover.Title>${title}</Popover.Title>`,
    `        <Popover.Description>${description}</Popover.Description>`,
    ...(showClose ? ['        <Popover.Close render={<Button size="sm">Close</Button>} />'] : []),
    "      </Popover.Popup>",
    "    </Popover.Positioner>",
    "  </Popover.Portal>",
    "</Popover.Root>",
  ].join("\n");
}

export const story = defineStory({
  displayName: "Popover",
  Component: PopoverDemo,
  args: presets,
});
