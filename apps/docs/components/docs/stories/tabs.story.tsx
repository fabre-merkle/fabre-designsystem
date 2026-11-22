import { type DocsStoryPreset, jsxSnippet } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { TabsDemo, type TabsDemoProps } from "./tabs-demo";

export const title = "Tabs";

/** Arguments that shape the example and are not Tabs props: drawn in the "Demo" group. */
export const demoArgs = ["disabledTab"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  variant: "line",
  size: "md",
  orientation: "horizontal",
  disabledTab: false,
} satisfies TabsDemoProps;

export const presets: DocsStoryPreset<TabsDemoProps>[] = [
  {
    variant: "Line",
    description: "An animated underline beneath the active tab.",
    initial: base,
  },
  {
    variant: "Segment",
    description:
      "A pill-shaped track. The active tab is a raised chip, with no separate indicator.",
    initial: { ...base, variant: "segment" },
  },
  {
    variant: "Small",
    description: "Sizes run from xs to lg. Change size to compare.",
    initial: { ...base, size: "sm" },
  },
  {
    variant: "Vertical",
    description: "The list sits on the inline-start edge. Arrow keys follow the orientation.",
    initial: { ...base, orientation: "vertical" },
  },
  {
    variant: "Disabled tab",
    description: "One tab is inert and skipped by keyboard navigation.",
    initial: { ...base, disabledTab: true },
  },
];

const TABS = ["overview", "activity", "settings"] as const;
const LABELS = { overview: "Overview", activity: "Activity", settings: "Settings" } as const;

/** The JSX a reader would write for one preset. */
export function snippet({ disabledTab, ...props }: TabsDemoProps): string {
  const open = jsxSnippet(
    "Tabs.Root",
    { defaultValue: "overview", ...props },
    { defaults: { variant: "line", size: "md", orientation: "horizontal" }, openOnly: true },
  );
  return [
    open,
    "  <Tabs.List>",
    ...TABS.map((value) => {
      const tab = jsxSnippet(
        "Tabs.Tab",
        { value, disabled: disabledTab && value === "activity" },
        {
          children: LABELS[value],
        },
      );
      return `    ${tab}`;
    }),
    "    <Tabs.Indicator />",
    "  </Tabs.List>",
    ...TABS.map((value) => `  <Tabs.Panel value="${value}">…</Tabs.Panel>`),
    "</Tabs.Root>",
  ].join("\n");
}

export const story = defineStory({
  displayName: "Tabs",
  Component: TabsDemo,
  args: presets,
});
