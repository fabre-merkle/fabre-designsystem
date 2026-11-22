import { type DocsStoryPreset, jsxSnippet, raw } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { ToolbarDemo, type ToolbarDemoProps } from "./toolbar-demo";

export const title = "Toolbar";
// The controls are generated from `ToolbarDemoProps` when this file compiles.
// (Edit this file after changing that type, so the generated controls refresh.)

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  orientation: "horizontal",
  disabled: false,
  loopFocus: true,
} satisfies ToolbarDemoProps;

export const presets: DocsStoryPreset<ToolbarDemoProps>[] = [
  {
    variant: "Horizontal",
    description: "One tab stop for the whole bar. Arrow keys, Home and End move between controls.",
    initial: base,
  },
  {
    variant: "Vertical",
    description: "Controls stack, and the arrow keys follow the orientation.",
    initial: { ...base, orientation: "vertical" },
  },
  {
    variant: "No focus loop",
    description: "With loopFocus off, the arrow keys stop at the first and last control.",
    initial: { ...base, loopFocus: false },
  },
  {
    variant: "Disabled",
    description: "Every control in the bar is inert.",
    initial: { ...base, disabled: true },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet({ orientation, disabled, loopFocus }: ToolbarDemoProps): string {
  const open = jsxSnippet(
    "Toolbar.Root",
    {
      "aria-label": "Formatting",
      orientation,
      disabled,
      // `jsxSnippet` omits `false`, and `false` is the non-default value here.
      loopFocus: loopFocus === false ? raw("false") : undefined,
    },
    { openOnly: true, defaults: { orientation: "horizontal" } },
  );
  return [
    open,
    "  <Toolbar.Group>",
    '    <Toolbar.Button aria-pressed="true">Bold</Toolbar.Button>',
    "    <Toolbar.Button>Italic</Toolbar.Button>",
    "  </Toolbar.Group>",
    "  <Toolbar.Separator />",
    '  <Toolbar.Input placeholder="Search" />',
    '  <Toolbar.Link href="/help">Help</Toolbar.Link>',
    "</Toolbar.Root>",
  ].join("\n");
}

export const story = defineStory({
  displayName: "Toolbar",
  Component: ToolbarDemo,
  args: presets,
});
