import { type DocsStoryPreset, jsxSnippet } from "../../../lib/docs-story-types";
import { defineStory } from "../../../lib/story";
import { ButtonDemo, type ButtonDemoProps } from "./button-demo";

export const title = "Button";

/** Arguments that shape the example and are not Button props: drawn in the "Demo" group. */
export const demoArgs = ["label", "icon", "surface", "showAllVariants"] as const;

/** Every control has a value, so the panel shows the real setting instead of "Default". */
const base = {
  variant: "primary",
  mode: "filled",
  size: "md",
  disabled: false,
  label: "Button",
  icon: "none",
  surface: "default",
  showAllVariants: false,
} satisfies ButtonDemoProps;

export const presets: DocsStoryPreset<ButtonDemoProps>[] = [
  {
    variant: "Filled",
    description: "Solid fill. Turn on showAllVariants under Demo to compare the four variants.",
    initial: { ...base, mode: "filled" },
  },
  {
    variant: "Stroke",
    description: "The family's tinted surface behind its border ramp. Not a transparent outline.",
    initial: { ...base, mode: "stroke" },
  },
  {
    variant: "Lighter",
    description: "A tinted surface with no border.",
    initial: { ...base, mode: "lighter" },
  },
  {
    variant: "Ghost",
    description: "Transparent at rest. Hover and press reveal the family's surface wash.",
    initial: { ...base, mode: "ghost" },
  },
  {
    variant: "Brand surface",
    description: "On a brand surface the inverse variant uses the on-brand foreground.",
    initial: {
      ...base,
      variant: "inverse",
      mode: "stroke",
      label: "Inverse stroke",
      surface: "brand",
    },
  },
  {
    variant: "Large",
    description: "Sizes run from xs to lg. Change size to compare.",
    initial: { ...base, size: "lg", label: "Large" },
  },
  {
    variant: "Start icon",
    description: 'An icon child with data-icon="inline-start" before the label.',
    initial: { ...base, label: "Start icon", icon: "start" },
  },
  {
    variant: "End icon",
    description: 'An icon child with data-icon="inline-end" after the label.',
    initial: { ...base, label: "End icon", icon: "end" },
  },
  {
    variant: "Icon only",
    description:
      "A square button: the icon is a child and an icon size sets the square. The label becomes its accessible name.",
    initial: { ...base, label: "Info", icon: "icon-only" },
  },
  {
    variant: "Disabled",
    description: "Not interactive and not focusable by pointer.",
    initial: { ...base, label: "Disabled", disabled: true },
  },
];

/** The square icon size that matches each height. */
const ICON_SIZE = { xs: "icon-xs", sm: "icon-sm", md: "icon", lg: "icon-lg" } as const;

const ALL_VARIANTS = ["primary", "secondary", "tertiary", "destructive"] as const;

/** The JSX a reader would write for one preset (one line per variant when they show side by side). */
export function snippet(props: ButtonDemoProps): string {
  const { label = "Button", icon = "none", showAllVariants, surface, ...rest } = props;
  const defaults = { variant: "primary", mode: "filled", size: "md" };
  const one = (variant: ButtonDemoProps["variant"]) => {
    const common = { ...rest, variant };
    if (icon === "icon-only") {
      const size = ICON_SIZE[(rest.size ?? "md") as keyof typeof ICON_SIZE] ?? rest.size;
      return jsxSnippet(
        "Button",
        { ...common, size, "aria-label": label },
        { defaults, children: "<Info />" },
      );
    }
    const children =
      icon === "start"
        ? `<Info data-icon="inline-start" />${label}`
        : icon === "end"
          ? `${label}<Info data-icon="inline-end" />`
          : label;
    return jsxSnippet("Button", common, { defaults, children });
  };
  const lines = showAllVariants ? ALL_VARIANTS.map(one) : [one(props.variant)];
  const body = lines.join("\n");
  return surface === "brand" ? `<div data-finish="brand">\n${body}\n</div>` : body;
}

export const story = defineStory({
  displayName: "Button",
  Component: ButtonDemo,
  args: presets,
});
