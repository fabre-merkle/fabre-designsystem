import { type DocsStoryPreset, jsxSnippet } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { NavigationMenuDemo, type NavigationMenuDemoProps } from "./navigation-menu-demo";

export const title = "Navigation Menu";
// The controls are generated from `NavigationMenuDemoProps` when this file compiles.
// (Edit this file after changing that type, so the generated controls refresh.)

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  delay: 50,
  closeDelay: 50,
} satisfies NavigationMenuDemoProps;

export const presets: DocsStoryPreset<NavigationMenuDemoProps>[] = [
  {
    variant: "Default",
    description:
      "Hover or press a trigger to open its panel; one shared viewport morphs between them.",
    initial: base,
  },
  {
    variant: "Slow to open",
    description: "A longer delay avoids opening a panel when the pointer only passes over.",
    initial: { ...base, delay: 400, closeDelay: 200 },
  },
  {
    variant: "Instant",
    description: "A delay of 0 opens a panel as soon as the pointer arrives.",
    initial: { ...base, delay: 0, closeDelay: 0 },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet(props: NavigationMenuDemoProps): string {
  const { delay, closeDelay } = props;
  const root = jsxSnippet(
    "NavigationMenu.Root",
    { delay, closeDelay },
    { openOnly: true, defaults: { delay: 50, closeDelay: 50 } },
  );
  return [
    root,
    "  <NavigationMenu.List>",
    "    <NavigationMenu.Item>",
    "      <NavigationMenu.Trigger>",
    "        Products",
    "        <NavigationMenu.Icon>▾</NavigationMenu.Icon>",
    "      </NavigationMenu.Trigger>",
    "      <NavigationMenu.Content>",
    '        <NavigationMenu.Link href="/analytics">Analytics</NavigationMenu.Link>',
    '        <NavigationMenu.Link href="/engagement">Engagement</NavigationMenu.Link>',
    "      </NavigationMenu.Content>",
    "    </NavigationMenu.Item>",
    "    <NavigationMenu.Item>",
    '      <NavigationMenu.Link href="/pricing">Pricing</NavigationMenu.Link>',
    "    </NavigationMenu.Item>",
    "  </NavigationMenu.List>",
    "  <NavigationMenu.Portal>",
    "    <NavigationMenu.Positioner>",
    "      <NavigationMenu.Popup>",
    "        <NavigationMenu.Viewport />",
    "      </NavigationMenu.Popup>",
    "    </NavigationMenu.Positioner>",
    "  </NavigationMenu.Portal>",
    "</NavigationMenu.Root>",
  ].join("\n");
}

export const story = defineStory({
  displayName: "NavigationMenu",
  Component: NavigationMenuDemo,
  args: presets,
});
