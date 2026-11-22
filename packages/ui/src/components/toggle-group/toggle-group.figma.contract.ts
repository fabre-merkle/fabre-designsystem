import { defineFigmaContract } from "../figma-contract";

export const toggleGroupFigmaContract = defineFigmaContract({
  schemaVersion: 1,
  slug: "toggle-group",
  componentName: "ToggleGroup",
  rootPart: "toggle-group",
  parts: ["toggle-group", "toggle-group-item"],
  // One set per variant and spacing ("Primary Joined ToggleGroup"), each holding
  // orientation x size x state.
  split: { axis: ["variant", "spacing"] },
  axes: [
    {
      // Source `size` also has the icon-* values. They are not Figma variants: an icon size is
      // the matching height, with every item an icon-only Toggle (that instance's own `content`
      // axis). The fold is recorded so Code Connect can map it back.
      prop: "size",
      values: ["xs", "sm", "md", "lg"],
      foldedValues: {
        "icon-xs": { size: "xs" },
        "icon-sm": { size: "sm" },
        icon: { size: "md" },
        "icon-lg": { size: "lg" },
      },
    },
    {
      prop: "orientation",
      values: ["horizontal", "vertical"],
      default: "horizontal",
      attribute: "data-orientation",
      valueSelectors: { horizontal: null, vertical: '[data-orientation="vertical"]' },
    },
    {
      // The component's own `spacing` prop. `joined` (gap 0) always draws the segmented track,
      // `gapped` never does; the CSS keys both off `data-spacing`.
      prop: "spacing",
      values: ["joined", "gapped"],
      default: "joined",
      attribute: "data-spacing",
    },
    {
      prop: "state",
      values: ["default", "disabled"],
      default: "default",
      attribute: "data-state",
      valueSelectors: {
        default: null,
        disabled: "[data-disabled]",
      },
    },
  ],
  // Composition: the item's entire visual
  // identity (padding, background, radius, selected state) lives in
  // `toggle.css`, a different component's stylesheet — the resolver
  // structurally cannot reach it (`cssSource` is singular), so the item is a
  // COMPOSED CHILD (a Toggle instance), not a styled part. Its variant and size follow the
  // group's; every other axis is Toggle's own default.
  slots: [
    {
      name: "item",
      part: "toggle-group-item",
      required: true,
      // Each set's items are the Toggle in that set's own variant and size: ToggleGroup passes both
      // to its items through context (`ToggleGroupContext`), so a Ghost group holds Ghost toggles.
      composedChild: {
        component: "toggle",
        variantKeyFromAxes: { variant: "variant", size: "size" },
      },
    },
  ],
  anatomy: {
    part: "toggle-group",
    kind: "frame",
    layout: "horizontal",
    layoutByAxis: {
      axis: "orientation",
      values: { horizontal: "horizontal", vertical: "vertical" },
    },
    requiredBindings: ["text"],
    children: [
      {
        part: "toggle-group-item",
        kind: "frame",
        layout: "horizontal",
        synthetic: true,
        repeat: 3,
        slots: ["item"],
      },
    ],
  },
  documentation: {
    coverage: "all-axes",
    examples: [
      {
        label: "Horizontal joined",
        key: { size: "sm" },
      },
      {
        label: "Horizontal gapped",
        key: { variant: "ghost", spacing: "gapped" },
      },
      {
        label: "Horizontal joined extra small",
        key: { size: "xs" },
      },
      {
        label: "Vertical disabled",
        key: { size: "lg", orientation: "vertical", state: "disabled" },
      },
    ],
  },
  reactToFigmaNotes: [
    "The item slot's default content is a Toggle instance: editing Toggle propagates to every ToggleGroup that composes it.",
    "The React `icon-*` sizes cascade to the items as square icon-only toggles at the matching height " +
      "and fold into size xs, sm, md and lg (`foldedValues`); the item slot holds a Toggle instance, so an " +
      "icon-only item is that instance's `content` axis.",
    "The generated definition demonstrates group orientation, grouping, and disabled state without reproducing Base UI selection behavior.",
  ],
});
