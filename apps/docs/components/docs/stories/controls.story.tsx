import type { DocsStoryPreset } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { ControlsDemo, type ControlsDemoProps } from "./controls-demo";

export const title = "Controls";
// The controls are generated from `ControlsDemoProps` when this file compiles.
// (Edit this file after changing that type, so the generated controls refresh.)

/** Arguments that shape the example and are not a size: drawn in the "Demo" group. */
export const demoArgs = ["scene"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Unset". */
const base = { size: "sm", scene: "row" } satisfies ControlsDemoProps;

export const presets: DocsStoryPreset<ControlsDemoProps>[] = [
  {
    variant: "Inline row",
    description:
      "A Button, a Toggle Group, segment Tabs and a Button at one size. They share one height and one text style, so they line up.",
    initial: base,
  },
  {
    variant: "Sizes",
    description: "xs, sm, md and lg: one height, padding, gap and text style per size.",
    initial: { ...base, scene: "sizes" },
  },
  {
    variant: "Tonal emphasis",
    description:
      "Primary is filled, secondary is lighter and tertiary is ghost. Give each action one emphasis, by priority.",
    initial: { ...base, size: "md", scene: "emphasis" },
  },
  {
    variant: "Segmented",
    description:
      "A joined Toggle Group draws one track with the items set inside it. A gapped group draws none.",
    initial: { ...base, size: "md", scene: "segmented" },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet({ size, scene }: ControlsDemoProps): string {
  const attr = size === "md" ? "" : ` size="${size}"`;
  if (scene === "sizes") {
    return ["xs", "sm", "md", "lg"].map((s) => `<Button size="${s}">${s}</Button>`).join("\n");
  }
  if (scene === "emphasis") {
    return [
      `<Button${attr} mode="filled">Primary</Button>`,
      `<Button${attr} mode="lighter">Secondary</Button>`,
      `<Button${attr} mode="ghost">Tertiary</Button>`,
    ].join("\n");
  }
  if (scene === "segmented") {
    return [
      `<ToggleGroup${attr} defaultValue={["b"]}>`,
      '  <Toggle value="a">Joined</Toggle>',
      '  <Toggle value="b">Items</Toggle>',
      "</ToggleGroup>",
      `<ToggleGroup${attr} spacing="gapped" defaultValue={["b"]}>`,
      '  <Toggle value="a">Gapped</Toggle>',
      '  <Toggle value="b">Items</Toggle>',
      "</ToggleGroup>",
    ].join("\n");
  }
  return [
    `<Button${attr} mode="lighter">Share</Button>`,
    `<ToggleGroup${attr} defaultValue={["week"]}>…</ToggleGroup>`,
    `<Tabs.Root${attr} variant="segment" defaultValue="list">…</Tabs.Root>`,
    `<Button${attr}>Publish</Button>`,
  ].join("\n");
}

export const story = defineStory({
  displayName: "Controls",
  Component: ControlsDemo,
  args: presets,
});
