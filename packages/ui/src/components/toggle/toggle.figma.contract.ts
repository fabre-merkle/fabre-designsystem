import { defineFigmaContract } from "../figma-contract";

export const toggleFigmaContract = defineFigmaContract({
  schemaVersion: 1,
  slug: "toggle",
  componentName: "Toggle",
  rootPart: "toggle",
  parts: ["toggle", "toggle-icon", "toggle-label"],
  // One set per variant and size ("Primary Md Toggle"), each holding content x pressed x state.
  split: { axis: ["variant", "size"] },
  // Two shapes. The text toggle has the four text sizes with a label or an icon beside it. The
  // icon-only toggle is square with its own sizes, so it splits on variant and pressed instead
  // ("Primary On Icon Toggle"), each set holding size x state, and its sizes keep their names.
  shapes: [
    { values: { size: ["xs", "sm", "md", "lg"], content: ["label", "icon-label"] } },
    {
      name: "Icon",
      values: { size: ["icon-xs", "icon-sm", "icon", "icon-lg"], content: ["icon-only"] },
      split: { axis: ["variant", "pressed"] },
    },
  ],
  // The ring is a layer shown by the `focus-visible` property, not a State value.
  focusRing: {},
  axes: [
    {
      prop: "pressed",
      values: ["off", "on"],
      default: "off",
      attribute: "data-pressed-state",
      valueSelectors: { off: null, on: "[data-pressed]" },
      codeProps: { on: { prop: "pressed", value: true } },
    },
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
  slots: [
    { name: "label", part: "toggle-label", required: true, codeProp: "children" },
    // Every icon part is a native slot — declared explicitly here
    // (never synthesized by the walker).
    { name: "icon", part: "toggle-icon", codeProp: "children" },
  ],
  anatomy: {
    part: "toggle",
    kind: "frame",
    layout: "horizontal",
    requiredBindings: ["text"],
    children: [
      {
        part: "toggle-icon",
        kind: "icon",
        iconName: "Check",
        unless: { content: "label" },
        slots: ["icon"],
      },
      {
        part: "toggle-label",
        kind: "text",
        slots: ["label"],
        unless: { content: "icon-only" },
        requiredBindings: ["textStyle"],
      },
    ],
  },
  documentation: {
    coverage: "all-axes",
    examples: [
      {
        label: "Primary off",
        key: {},
        slots: { label: "Bold" },
      },
      {
        label: "Primary on",
        key: { size: "sm", pressed: "on", content: "icon-label" },
        slots: { label: "Bold" },
      },
      {
        label: "Ghost on",
        key: { variant: "ghost", size: "lg", pressed: "on" },
        slots: { label: "Italic" },
      },
      {
        label: "Ghost icon only",
        key: { variant: "ghost", size: "icon-sm", content: "icon-only" },
        slots: { label: "Italic" },
      },
      {
        label: "Icon only",
        key: { size: "icon", content: "icon-only" },
        slots: { label: "Italic" },
      },
      {
        label: "Icon only extra small",
        key: { size: "icon-xs", content: "icon-only" },
        slots: { label: "Italic" },
      },
      {
        label: "Icon only large",
        key: { size: "icon-lg", content: "icon-only" },
        slots: { label: "Italic" },
      },
      {
        label: "Primary extra small on",
        key: { size: "xs", pressed: "on" },
        slots: { label: "Grid" },
      },
      {
        label: "Ghost disabled",
        key: { variant: "ghost", state: "disabled" },
        slots: { label: "Underline" },
      },
      {
        label: "Hover",
        key: { state: "hover" },
        slots: { label: "Underline" },
      },
      {
        label: "Pressed",
        key: { state: "active" },
        slots: { label: "Underline" },
      },
    ],
  },
  reactToFigmaNotes: [
    "pressed and state are explicit display axes for Base UI runtime states.",
    "The focus ring is the `focus-visible` boolean property, generated as a layer from the " +
      "root's `:focus-visible` outline. It is a browser state, so it is not mapped to a prop.",
    "content: `icon-label` is `data-has-icon` (a direct child with `data-icon`, or an " +
      "svg), `icon-only` is `data-icon-only` (any `icon*` size, or an icon with no text). " +
      "The React `icon-xs`, `icon-sm`, `icon` and `icon-lg` sizes are the Icon shape: sets named " +
      "`<Variant> <Pressed> Icon Toggle`, with `content` fixed to `icon-only`.",
    "variant and size split the text toggle into one set each (`Primary Md Toggle`), so a Code " +
      "Connect template fixes both props and reads content, pressed and state from the instance.",
  ],
});
