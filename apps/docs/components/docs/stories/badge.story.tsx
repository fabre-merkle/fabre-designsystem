import { type DocsStoryPreset, jsxSnippet } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { BadgeDemo, type BadgeDemoProps } from "./badge-demo";

export const title = "Badge";
// The controls are generated from `BadgeDemoProps` when this file compiles.
// (Edit this file after changing that type, so the generated controls refresh.)

/** Arguments that shape the example and are not Badge props: drawn in the "Demo" group. */
export const demoArgs = ["label"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  tone: "neutral",
  mode: "filled",
  size: "md",
  label: "Active",
} satisfies BadgeDemoProps;

export const presets: DocsStoryPreset<BadgeDemoProps>[] = [
  {
    variant: "Neutral",
    description: "The default: a plain label with no status meaning.",
    initial: base,
  },
  {
    variant: "Info",
    description: "Neutral news or a category.",
    initial: { ...base, tone: "info", label: "New" },
  },
  {
    variant: "Success",
    description: "A healthy or completed state.",
    initial: { ...base, tone: "success", label: "Active" },
  },
  {
    variant: "Warning",
    description: "Something needs attention but nothing has failed.",
    initial: { ...base, tone: "warning", label: "Pending" },
  },
  {
    variant: "Critical",
    description: "A failed or blocked state. Maps to the error token family.",
    initial: { ...base, tone: "critical", label: "Failed" },
  },
  {
    variant: "Light",
    description: "A tinted container with coloured text, quieter than filled.",
    initial: { ...base, tone: "success", mode: "light" },
  },
  {
    variant: "Stroke",
    description: "An outline with no fill, quietest of the three modes.",
    initial: { ...base, tone: "success", mode: "stroke" },
  },
  {
    variant: "Small",
    description: "Sizes run sm, md and lg. Change size to compare.",
    initial: { ...base, tone: "info", size: "sm", label: "Beta" },
  },
  {
    variant: "Large",
    description: "The lg badge, for headings and summaries.",
    initial: { ...base, tone: "info", size: "lg", label: "Beta" },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet({ label = "Active", ...props }: BadgeDemoProps): string {
  return jsxSnippet("Badge", props, {
    children: label,
    defaults: { tone: "neutral", mode: "filled", size: "md" },
  });
}

export const story = defineStory({
  displayName: "Badge",
  Component: BadgeDemo,
  args: presets,
});
