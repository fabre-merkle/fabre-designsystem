import type { DocsStoryPreset } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { ContextMenuDemo, type ContextMenuDemoProps } from "./context-menu-demo";

export const title = "Context Menu";
// The controls are generated from `ContextMenuDemoProps` when this file compiles.
// (Edit this file after changing that type, so the generated controls refresh.)

/** Arguments that shape the example and are not ContextMenu props: drawn in the "Demo" group. */
export const demoArgs = ["triggerLabel", "content"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  triggerLabel: "Right-click anywhere in this area",
  content: "actions",
} satisfies ContextMenuDemoProps;

export const presets: DocsStoryPreset<ContextMenuDemoProps>[] = [
  {
    variant: "Actions",
    description: "A list of actions at the pointer, with a separator before the risky one.",
    initial: base,
  },
  {
    variant: "Checkbox items",
    description: "ContextMenu.CheckboxItem toggles an option without closing the menu.",
    initial: { ...base, content: "checkboxes" },
  },
  {
    variant: "Radio items",
    description: "ContextMenu.RadioGroup holds one choice among several.",
    initial: { ...base, content: "radios" },
  },
  {
    variant: "Submenu",
    description:
      "ContextMenu.SubmenuRoot and ContextMenu.SubmenuTrigger nest a menu with a trailing caret.",
    initial: { ...base, content: "submenu" },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet(props: ContextMenuDemoProps): string {
  const { triggerLabel = "Right-click anywhere in this area", content } = props;
  let items: string[];
  if (content === "checkboxes") {
    items = [
      "<ContextMenu.Group>",
      "  <ContextMenu.GroupLabel>View</ContextMenu.GroupLabel>",
      "  <ContextMenu.CheckboxItem checked={showGrid} onCheckedChange={setShowGrid}>",
      "    <ContextMenu.CheckboxItemIndicator />",
      "    Show grid",
      "  </ContextMenu.CheckboxItem>",
      "</ContextMenu.Group>",
    ];
  } else if (content === "radios") {
    items = [
      '<ContextMenu.RadioGroup defaultValue="name">',
      "  <ContextMenu.GroupLabel>Sort by</ContextMenu.GroupLabel>",
      '  <ContextMenu.RadioItem value="name">',
      "    <ContextMenu.RadioItemIndicator />",
      "    Name",
      "  </ContextMenu.RadioItem>",
      '  <ContextMenu.RadioItem value="date">',
      "    <ContextMenu.RadioItemIndicator />",
      "    Date",
      "  </ContextMenu.RadioItem>",
      "</ContextMenu.RadioGroup>",
    ];
  } else if (content === "submenu") {
    items = [
      "<ContextMenu.Item>Copy</ContextMenu.Item>",
      "<ContextMenu.SubmenuRoot>",
      "  <ContextMenu.SubmenuTrigger>Share</ContextMenu.SubmenuTrigger>",
      "  <ContextMenu.Portal>",
      "    <ContextMenu.Positioner>",
      "      <ContextMenu.Popup>",
      "        <ContextMenu.Item>Copy link</ContextMenu.Item>",
      "        <ContextMenu.Item>Email</ContextMenu.Item>",
      "      </ContextMenu.Popup>",
      "    </ContextMenu.Positioner>",
      "  </ContextMenu.Portal>",
      "</ContextMenu.SubmenuRoot>",
      "<ContextMenu.Separator />",
      "<ContextMenu.Item>Delete</ContextMenu.Item>",
    ];
  } else {
    items = [
      "<ContextMenu.Item>Copy</ContextMenu.Item>",
      "<ContextMenu.Item>Paste</ContextMenu.Item>",
      "<ContextMenu.Item>Duplicate</ContextMenu.Item>",
      "<ContextMenu.Separator />",
      "<ContextMenu.Item>Delete</ContextMenu.Item>",
    ];
  }
  return [
    "<ContextMenu.Root>",
    `  <ContextMenu.Trigger>${triggerLabel}</ContextMenu.Trigger>`,
    "  <ContextMenu.Portal>",
    "    <ContextMenu.Positioner>",
    "      <ContextMenu.Popup>",
    ...items.map((line) => `        ${line}`),
    "      </ContextMenu.Popup>",
    "    </ContextMenu.Positioner>",
    "  </ContextMenu.Portal>",
    "</ContextMenu.Root>",
  ].join("\n");
}

export const story = defineStory({
  displayName: "ContextMenu",
  Component: ContextMenuDemo,
  args: presets,
});
