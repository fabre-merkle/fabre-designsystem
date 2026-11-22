import { defineFigmaContract } from "../figma-contract";

export const buttonFigmaContract = defineFigmaContract({
  schemaVersion: 1,
  slug: "button",
  componentName: "Button",
  rootPart: "button",
  parts: ["button", "button-label", "button-icon"],
  // One set per variant and mode ("Primary Filled Button"), each holding size x content x state.
  split: { axis: ["variant", "mode"] },
  // Two shapes. The text button has the four text sizes with a label or an icon beside it; the
  // icon-only button is square with its own four sizes and no label, so it is sets of its own
  // ("Primary Filled Icon Button") and no combination of an icon size with a label exists.
  shapes: [
    { values: { size: ["xs", "sm", "md", "lg"], content: ["label", "icon-label"] } },
    {
      name: "Icon",
      values: { size: ["icon-xs", "icon-sm", "icon", "icon-lg"], content: ["icon-only"] },
    },
  ],
  // The ring is a layer shown by the `focus-visible` property, not a State value, so it adds no
  // variants and shows on top of any state.
  focusRing: {},
  // size x content x state is one grid a designer reads across, so the two sets of a text button
  // that hold 32 variants (two over the guideline of 30) stay whole.
  capReason:
    "A text button's size, content and state are one grid a designer reads across. Splitting a third axis out would make 60 sets of 16, to save two variants over the 30-variant guideline.",
  axes: [
    {
      prop: "content",
      values: ["label", "icon-label", "icon-only"],
      default: "label",
      attribute: "data-content",
      valueSelectors: {
        label: null,
        "icon-label": '[data-has-icon][data-icon-side="start"]',
        "icon-only": "[data-icon-only]",
      },
    },
    {
      prop: "state",
      values: ["default", "hover", "active", "disabled"],
      default: "default",
      attribute: "data-state",
      valueSelectors: {
        default: null,
        hover: ":hover",
        active: ":active",
        disabled: "[data-disabled]",
      },
      codeProps: { disabled: { prop: "disabled", value: true } },
    },
  ],
  // The label text and the swappable icon are properties, not variants. An icon beside a label
  // stays a variant (`icon-label`): the CSS trims the padding on the icon's side, and a boolean
  // cannot change the frame's padding. Label and icon are both the component's children, composed
  // in anatomy order (icon first).
  properties: [
    { type: "text", name: "Label", part: "button-label", default: "Button", codeProp: "children" },
    { type: "instanceSwap", name: "Icon", part: "button-icon", codeProp: "children" },
  ],
  anatomy: {
    part: "button",
    kind: "frame",
    layout: "horizontal",
    requiredBindings: ["text"],
    children: [
      // The icon comes first, as the start icon of the `icon-label` content.
      {
        part: "button-icon",
        kind: "icon",
        iconName: "CaretDown",
        unless: { content: "label" },
      },
      {
        part: "button-label",
        kind: "text",
        unless: { content: "icon-only" },
        requiredBindings: ["textStyle"],
      },
    ],
  },
  documentation: {
    coverage: "all-axes",
    examples: [
      {
        label: "Primary filled",
        key: {},
      },
      {
        label: "Secondary stroke",
        key: { variant: "secondary", mode: "stroke", size: "sm" },
      },
      {
        label: "Tertiary lighter",
        key: { variant: "tertiary", mode: "lighter", size: "lg" },
      },
      {
        label: "Secondary icon and label",
        key: { variant: "secondary", mode: "lighter", content: "icon-label" },
      },
      {
        label: "Primary ghost extra small",
        key: { mode: "ghost", size: "xs" },
      },
      {
        label: "Destructive ghost disabled",
        key: { variant: "destructive", mode: "ghost", state: "disabled" },
      },
      {
        label: "Primary filled hover",
        key: { state: "hover" },
      },
      {
        label: "Secondary lighter pressed",
        key: { variant: "secondary", mode: "lighter", state: "active" },
      },
      {
        label: "Inverse stroke",
        key: { variant: "inverse", mode: "stroke" },
      },
      {
        label: "Icon only",
        key: { size: "icon", content: "icon-only" },
      },
      {
        label: "Icon only extra small",
        key: { size: "icon-xs", content: "icon-only" },
      },
      {
        label: "Icon only small",
        key: { size: "icon-sm", content: "icon-only" },
      },
      {
        label: "Icon only large",
        key: { size: "icon-lg", content: "icon-only" },
      },
    ],
  },
  reactToFigmaNotes: [
    "state is a design-only display axis. `disabled` is the React disabled prop; `hover` and " +
      "`active` are browser states (`:hover`, `:active`) with no prop to set.",
    "The focus ring is the `focus-visible` boolean property, generated as a layer from the " +
      "root's `:focus-visible` outline. It is a browser state, so it is not mapped to a prop.",
    "content groups the React icon-only and child-content combinations into stable Figma examples: " +
      "`icon-label` is `data-has-icon` (a direct child with `data-icon`, or an svg), " +
      "`icon-only` is `data-icon-only` (any `icon*` size). The label text and the icon are the " +
      "`Label` text property and the `Icon` instance swap, so a designer edits them on an instance.",
    "The React `icon-xs`, `icon-sm`, `icon` and `icon-lg` sizes are the Icon shape: sets named " +
      "`<Variant> <Mode> Icon Button`, with `content` fixed to `icon-only`. No icon size is paired " +
      "with a label.",
    "variant and mode split the output into one set each (`Primary Filled Button`), so a Code " +
      "Connect template fixes both props and reads size, content and state from the instance.",
  ],
});
