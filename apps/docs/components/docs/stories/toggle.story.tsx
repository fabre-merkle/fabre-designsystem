import { type DocsStoryPreset, jsxSnippet } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { ToggleDemo, type ToggleDemoProps } from "./toggle-demo";

export const title = "Toggle";

/** Arguments that shape the example and are not Toggle props: drawn in the "Demo" group. */
export const demoArgs = ["label", "iconPlacement"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  variant: "primary",
  size: "md",
  disabled: false,
  defaultPressed: true,
  label: "Bold",
  iconPlacement: "none",
} satisfies ToggleDemoProps;

export const presets: DocsStoryPreset<ToggleDemoProps>[] = [
  {
    variant: "Pressed",
    description: "The primary toggle, pressed. Press it to turn it off.",
    initial: base,
  },
  {
    variant: "Unpressed",
    description: "At rest it sits on the recessed surface and takes a wash on hover.",
    initial: { ...base, defaultPressed: false },
  },
  {
    variant: "Ghost",
    description: "A ghost toggle shows the family's selected surface when pressed.",
    initial: { ...base, variant: "ghost" },
  },
  {
    variant: "Small",
    description: "Sizes run from xs to lg. Change size to compare.",
    initial: { ...base, size: "sm" },
  },
  {
    variant: "Start icon",
    description: "An icon before the label.",
    initial: { ...base, iconPlacement: "start" },
  },
  {
    variant: "Icon only",
    description: "A square toggle. The label becomes its accessible name.",
    initial: { ...base, iconPlacement: "icon-only" },
  },
  {
    variant: "Disabled",
    description: "Not interactive and skipped by pointer.",
    initial: { ...base, disabled: true },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet(props: ToggleDemoProps): string {
  const { label = "Bold", iconPlacement = "none", size, ...rest } = props;
  const defaults = { variant: "primary", size: "md" };
  if (iconPlacement === "icon-only") {
    const iconSizes = { xs: "icon-xs", sm: "icon-sm", md: "icon", lg: "icon-lg" } as const;
    const iconOnlySize = iconSizes[(size ?? "md") as keyof typeof iconSizes] ?? size;
    return jsxSnippet(
      "Toggle",
      { ...rest, size: iconOnlySize, "aria-label": label },
      { defaults: { variant: "primary" }, children: "<TextB />" },
    );
  }
  const icon = iconPlacement === "start" ? "<TextB />" : "";
  return jsxSnippet("Toggle", { ...rest, size }, { defaults, children: `${icon}${label}` });
}

export const story = defineStory({
  displayName: "Toggle",
  Component: ToggleDemo,
  args: presets,
});
