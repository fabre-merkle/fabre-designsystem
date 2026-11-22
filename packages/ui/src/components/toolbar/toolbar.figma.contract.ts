import { defineFigmaContract } from "../figma-contract";

export const toolbarFigmaContract = defineFigmaContract({
  schemaVersion: 1,
  slug: "toolbar",
  componentName: "Toolbar",
  rootPart: "toolbar-root",
  parts: [
    "toolbar-root",
    "toolbar-group",
    "toolbar-button",
    "toolbar-button-label",
    "toolbar-link",
    "toolbar-link-label",
    "toolbar-input",
    "toolbar-separator",
  ],
  axes: [
    {
      prop: "orientation",
      values: ["horizontal", "vertical"],
      default: "horizontal",
      attribute: "data-orientation",
      // Base UI always sets `data-orientation` on the root, so both values get a
      // real selector (no unqualified state exists for `null` to describe).
      valueSelectors: {
        horizontal: '[data-orientation="horizontal"]',
        vertical: '[data-orientation="vertical"]',
      },
      // Base UI's ToolbarSeparator orientation "defaults to the opposite of
      // the toolbar's orientation, so a horizontal toolbar renders vertical
      // separators" (`@base-ui/react` ToolbarSeparatorProps). The separator's own
      // `data-orientation` is therefore the INVERSE of this axis value.
      partValueSelectors: {
        "toolbar-separator": {
          horizontal: '[data-orientation="vertical"]',
          vertical: '[data-orientation="horizontal"]',
        },
      },
    },
    {
      prop: "pressed",
      values: ["off", "on"],
      default: "off",
      attribute: "data-pressed-state",
      valueSelectors: { off: null, on: "[data-pressed]" },
    },
    {
      prop: "state",
      values: ["default", "hover", "active", "focus-visible", "disabled"],
      default: "default",
      attribute: "data-state",
      valueSelectors: {
        default: null,
        hover: ":hover",
        active: ":active",
        "focus-visible": ":focus-visible",
        disabled: "[data-disabled]",
      },
    },
  ],
  slots: [
    { name: "button-label", part: "toolbar-button-label", required: true },
    { name: "link-label", part: "toolbar-link-label", required: true },
    { name: "placeholder", part: "toolbar-input", required: true },
  ],
  anatomy: {
    part: "toolbar-root",
    kind: "frame",
    layout: "horizontal",
    layoutByAxis: {
      axis: "orientation",
      values: { horizontal: "horizontal", vertical: "vertical" },
    },
    requiredBindings: ["fill", "text"],
    children: [
      {
        part: "toolbar-group",
        kind: "frame",
        layout: "horizontal",
        layoutByAxis: {
          axis: "orientation",
          values: { horizontal: "horizontal", vertical: "vertical" },
        },
        children: [
          {
            part: "toolbar-button",
            kind: "frame",
            layout: "horizontal",
            requiredBindings: ["text"],
            items: [
              {
                key: { pressed: "off", state: "default" },
                slots: { "button-label": "Bold" },
              },
              {
                key: { pressed: "on", state: "default" },
                slots: { "button-label": "Italic" },
              },
              {
                key: { pressed: "off", state: "disabled" },
                slots: { "button-label": "Underline" },
              },
            ],
            children: [
              {
                part: "toolbar-button-label",
                kind: "text",
                slots: ["button-label"],
                requiredBindings: ["textStyle"],
              },
            ],
          },
          {
            part: "toolbar-link",
            kind: "frame",
            layout: "horizontal",
            requiredBindings: ["text"],
            children: [
              {
                part: "toolbar-link-label",
                kind: "text",
                slots: ["link-label"],
                requiredBindings: ["textStyle"],
              },
            ],
          },
        ],
      },
      {
        part: "toolbar-separator",
        kind: "rectangle",
        requiredBindings: ["fill"],
      },
      {
        // A FRAME, not a text node. `[data-ui="toolbar-input"]` is an <input>, so
        // one element carries both a box (height, padding-inline, border-radius,
        // background) and its text. Figma splits those: `cornerRadius` and padding
        // do not exist on a TEXT node, so declaring this as text threw
        // `invalid field for text node: 'cornerRadius'` on every cell and dropped
        // the box entirely. A frame carrying the slot gets its text child from the
        // walker — the same shape `input.figma.contract.ts` already uses for the
        // standalone <input>.
        part: "toolbar-input",
        kind: "frame",
        layout: "horizontal",
        slots: ["placeholder"],
        requiredBindings: ["text", "textStyle"],
      },
    ],
  },
  documentation: {
    coverage: "all-axes",
    examples: [
      {
        label: "Horizontal",
        key: {},
        slots: {
          "button-label": "Bold",
          "link-label": "Help",
          placeholder: "Search",
        },
      },
      {
        label: "Vertical pressed",
        key: { orientation: "vertical", pressed: "on" },
        slots: {
          "button-label": "Bold",
          "link-label": "Help",
          placeholder: "Search",
        },
      },
      {
        label: "Disabled",
        key: { state: "disabled" },
        slots: {
          "button-label": "Bold",
          "link-label": "Help",
          placeholder: "Search",
        },
      },
      {
        label: "Hover",
        key: { state: "hover" },
        slots: {
          "button-label": "Bold",
          "link-label": "Help",
          placeholder: "Search",
        },
      },
      {
        label: "Pressed",
        key: { state: "active" },
        slots: {
          "button-label": "Bold",
          "link-label": "Help",
          placeholder: "Search",
        },
      },
      {
        label: "Focused",
        key: { state: "focus-visible" },
        slots: {
          "button-label": "Bold",
          "link-label": "Help",
          placeholder: "Search",
        },
      },
    ],
  },
  reactToFigmaNotes: [
    "pressed and state flatten runtime control states across the toolbar example.",
    "The generated definition demonstrates the compound control anatomy without reproducing roving focus behavior.",
    "An overflow axis is omitted because the source toolbar does not implement a visually distinct overflow control.",
  ],
});
