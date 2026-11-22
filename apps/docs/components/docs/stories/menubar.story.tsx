import { type DocsStoryPreset, jsxSnippet, raw } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { MenubarDemo, type MenubarDemoProps } from "./menubar-demo";

export const title = "Menubar";
// The controls are generated from `MenubarDemoProps` when this file compiles.
// (Edit this file after changing that type, so the generated controls refresh.)

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  modal: true,
  disabled: false,
  orientation: "horizontal",
  loopFocus: true,
} satisfies MenubarDemoProps;

export const presets: DocsStoryPreset<MenubarDemoProps>[] = [
  {
    variant: "Default",
    description: "Arrow keys move between menus; once one is open, hovering another opens it.",
    initial: base,
  },
  {
    variant: "Vertical",
    description: 'orientation="vertical" stacks the bar and moves between menus with Up and Down.',
    initial: { ...base, orientation: "vertical" },
  },
  {
    variant: "Non-modal",
    description: "The page behind stays interactive while a menu is open.",
    initial: { ...base, modal: false },
  },
  {
    variant: "No focus loop",
    description: "Keyboard focus stops at the first and last menu instead of wrapping.",
    initial: { ...base, loopFocus: false },
  },
  {
    variant: "Disabled",
    description: "No menu in the bar opens.",
    initial: { ...base, disabled: true },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet(props: MenubarDemoProps): string {
  const { modal, disabled, orientation, loopFocus } = props;
  const root = jsxSnippet(
    "Menubar.Root",
    {
      modal: modal === false ? raw("false") : undefined,
      disabled,
      orientation: orientation === "vertical" ? "vertical" : undefined,
      loopFocus: loopFocus === false ? raw("false") : undefined,
    },
    { openOnly: true },
  );
  return [
    root,
    "  <Menu.Root>",
    "    <Menubar.Trigger>File</Menubar.Trigger>",
    "    <Menu.Portal>",
    "      <Menu.Positioner sideOffset={8}>",
    "        <Menu.Popup>",
    "          <Menu.Item>New</Menu.Item>",
    "          <Menu.Item>Open…</Menu.Item>",
    "          <Menu.Separator />",
    "          <Menu.Item>Save</Menu.Item>",
    "        </Menu.Popup>",
    "      </Menu.Positioner>",
    "    </Menu.Portal>",
    "  </Menu.Root>",
    "  <Menu.Root>",
    "    <Menubar.Trigger>Edit</Menubar.Trigger>",
    "    {/* … */}",
    "  </Menu.Root>",
    "</Menubar.Root>",
  ].join("\n");
}

export const story = defineStory({
  displayName: "Menubar",
  Component: MenubarDemo,
  args: presets,
});
