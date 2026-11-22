import { type DocsStoryPreset, jsxSnippet } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { AvatarDemo, type AvatarDemoProps } from "./avatar-demo";

export const title = "Avatar";
// The controls are generated from `AvatarDemoProps` when this file compiles.
// (Edit this file after changing that type, so the generated controls refresh.)

/** Arguments that shape the example and are not Avatar props: drawn in the "Demo" group. */
export const demoArgs = ["initials", "showImage"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  size: "md",
  shape: "circle",
  initials: "AL",
  showImage: true,
} satisfies AvatarDemoProps;

export const presets: DocsStoryPreset<AvatarDemoProps>[] = [
  {
    variant: "Photo",
    description: "The image once it loads; the fallback shows until then.",
    initial: base,
  },
  {
    variant: "Fallback",
    description:
      "With no src, or if the image fails, the fallback renders. Use initials or an icon.",
    initial: { ...base, showImage: false },
  },
  {
    variant: "Small",
    description: "Sizes run sm 24px, md 32px, lg 40px. Change size to compare.",
    initial: { ...base, size: "sm" },
  },
  {
    variant: "Large",
    description: "The lg avatar, for profile headers.",
    initial: { ...base, size: "lg" },
  },
  {
    variant: "Square",
    description: "A soft-cornered square instead of a circle.",
    initial: { ...base, shape: "square", size: "lg", initials: "GH" },
  },
];

/** The JSX a reader would write for one preset. */
export function snippet(props: AvatarDemoProps): string {
  const { size, shape, initials = "AL", showImage } = props;
  const root = jsxSnippet(
    "Avatar.Root",
    { size, shape },
    { openOnly: true, defaults: { size: "md", shape: "circle" } },
  );
  return [
    root,
    ...(showImage ? ['  <Avatar.Image src="/users/ada.jpg" alt="Ada Lovelace" />'] : []),
    `  <Avatar.Fallback>${initials}</Avatar.Fallback>`,
    "</Avatar.Root>",
  ].join("\n");
}

export const story = defineStory({
  displayName: "Avatar",
  Component: AvatarDemo,
  args: presets,
});
