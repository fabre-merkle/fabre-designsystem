import { type DocsStoryPreset, jsxSnippet, raw } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { DrawerDemo, type DrawerDemoProps } from "./drawer-demo";

export const title = "Drawer";
// The controls are generated from `DrawerDemoProps` when this file compiles.
// (Edit this file after changing that type, so the generated controls refresh.)

/** Arguments that shape the example and are not Drawer props: drawn in the "Demo" group. */
export const demoArgs = ["triggerLabel", "title", "description"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  triggerLabel: "Open drawer",
  title: "Notification preferences",
  description: "Choose how and when you'd like to be notified.",
  side: "down",
  modal: true,
  disablePointerDismissal: false,
} satisfies DrawerDemoProps;

export const presets: DocsStoryPreset<DrawerDemoProps>[] = [
  {
    variant: "Bottom",
    description: "Docks to the bottom edge and swipes down to dismiss.",
    initial: base,
  },
  {
    variant: "Side panel",
    description: 'side="right" docks to the inline-end edge; "left" docks to the other side.',
    initial: { ...base, side: "right", triggerLabel: "Open side panel" },
  },
  {
    variant: "Top",
    description: "Docks to the top edge and swipes up to dismiss.",
    initial: { ...base, side: "up", triggerLabel: "Open top drawer" },
  },
  {
    variant: "Non-modal",
    description: "The page behind stays interactive and focus is not trapped.",
    initial: { ...base, modal: false, triggerLabel: "Open non-modal drawer" },
  },
  {
    variant: "Persistent",
    description: "An outside click does not dismiss it; only the actions or Escape close it.",
    initial: { ...base, disablePointerDismissal: true, triggerLabel: "Open persistent drawer" },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet(props: DrawerDemoProps): string {
  const {
    triggerLabel = "Open drawer",
    title,
    description,
    side,
    modal,
    disablePointerDismissal,
  } = props;
  const root = jsxSnippet(
    "Drawer.Root",
    {
      side: side === "down" ? undefined : side,
      modal: modal === false ? raw("false") : undefined,
      disablePointerDismissal,
    },
    { openOnly: true },
  );
  return [
    root,
    `  <Drawer.Trigger render={<Button>${triggerLabel}</Button>} />`,
    "  <Drawer.Portal>",
    "    <Drawer.Backdrop />",
    "    <Drawer.Viewport>",
    "      <Drawer.Popup>",
    `        <Drawer.Title>${title}</Drawer.Title>`,
    `        <Drawer.Description>${description}</Drawer.Description>`,
    "        <Drawer.Close render={<Button>Save preferences</Button>} />",
    "      </Drawer.Popup>",
    "    </Drawer.Viewport>",
    "  </Drawer.Portal>",
    "</Drawer.Root>",
  ].join("\n");
}

export const story = defineStory({
  displayName: "Drawer",
  Component: DrawerDemo,
  args: presets,
});
