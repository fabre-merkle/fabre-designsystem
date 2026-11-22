import { type DocsStoryPreset, jsxSnippet, raw } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { MenuDemo, type MenuDemoProps } from "./menu-demo";

export const title = "Menu";
// The controls are generated from `MenuDemoProps` when this file compiles.
// (Edit this file after changing that type, so the generated controls refresh.)

/** Arguments that shape the example and are not Menu props: drawn in the "Demo" group. */
export const demoArgs = ["triggerLabel", "content"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  modal: true,
  disabled: false,
  triggerLabel: "Actions",
  content: "actions",
} satisfies MenuDemoProps;

export const presets: DocsStoryPreset<MenuDemoProps>[] = [
  {
    variant: "Actions",
    description: "A list of actions anchored to a trigger, with a separator before the risky one.",
    initial: base,
  },
  {
    variant: "Checkbox items",
    description: "Menu.CheckboxItem toggles an option without closing the menu.",
    initial: { ...base, content: "checkboxes", triggerLabel: "View" },
  },
  {
    variant: "Radio items",
    description: "Menu.RadioGroup holds one choice among several.",
    initial: { ...base, content: "radios", triggerLabel: "Sort" },
  },
  {
    variant: "Submenu",
    description: "Menu.SubmenuRoot and Menu.SubmenuTrigger nest a menu with a trailing caret.",
    initial: { ...base, content: "submenu" },
  },
  {
    variant: "Non-modal",
    description: "The page behind stays interactive while the menu is open.",
    initial: { ...base, modal: false, triggerLabel: "Non-modal menu" },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet(props: MenuDemoProps): string {
  const { modal, disabled, triggerLabel = "Actions", content } = props;
  const root = jsxSnippet(
    "Menu.Root",
    { modal: modal === false ? raw("false") : undefined, disabled },
    { openOnly: true },
  );
  let items: string[];
  if (content === "checkboxes") {
    items = [
      "      <Menu.Group>",
      "        <Menu.GroupLabel>View</Menu.GroupLabel>",
      "        <Menu.CheckboxItem checked={showGrid} onCheckedChange={setShowGrid}>",
      "          <Menu.CheckboxItemIndicator />",
      "          Show grid",
      "        </Menu.CheckboxItem>",
      "      </Menu.Group>",
    ];
  } else if (content === "radios") {
    items = [
      '      <Menu.RadioGroup defaultValue="name">',
      "        <Menu.GroupLabel>Sort by</Menu.GroupLabel>",
      '        <Menu.RadioItem value="name">',
      "          <Menu.RadioItemIndicator />",
      "          Name",
      "        </Menu.RadioItem>",
      '        <Menu.RadioItem value="date">',
      "          <Menu.RadioItemIndicator />",
      "          Date",
      "        </Menu.RadioItem>",
      "      </Menu.RadioGroup>",
    ];
  } else if (content === "submenu") {
    items = [
      "      <Menu.Item>Edit</Menu.Item>",
      "      <Menu.SubmenuRoot>",
      "        <Menu.SubmenuTrigger>Share</Menu.SubmenuTrigger>",
      "        <Menu.Portal>",
      "          <Menu.Positioner>",
      "            <Menu.Popup>",
      "              <Menu.Item>Copy link</Menu.Item>",
      "              <Menu.Item>Email</Menu.Item>",
      "            </Menu.Popup>",
      "          </Menu.Positioner>",
      "        </Menu.Portal>",
      "      </Menu.SubmenuRoot>",
      "      <Menu.Separator />",
      "      <Menu.Item>Delete</Menu.Item>",
    ];
  } else {
    items = [
      "      <Menu.Item>Edit</Menu.Item>",
      "      <Menu.Item>Duplicate</Menu.Item>",
      "      <Menu.Item>Share</Menu.Item>",
      "      <Menu.Separator />",
      "      <Menu.Item>Delete</Menu.Item>",
    ];
  }
  return [
    root,
    `  <Menu.Trigger render={<Button variant="secondary">${triggerLabel}</Button>} />`,
    "  <Menu.Portal>",
    "    <Menu.Positioner sideOffset={8}>",
    "      <Menu.Popup>",
    ...items.map((line) => `  ${line}`),
    "      </Menu.Popup>",
    "    </Menu.Positioner>",
    "  </Menu.Portal>",
    "</Menu.Root>",
  ].join("\n");
}

export const story = defineStory({
  displayName: "Menu",
  Component: MenuDemo,
  args: presets,
});
