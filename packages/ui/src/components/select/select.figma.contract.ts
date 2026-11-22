import { defineFigmaContract } from "../figma-contract";

/**
 * Select. Trigger-anchored: the anatomy root is a synthetic, unpainted vertical frame
 * (`select-root`) holding the real, styled trigger (`select-trigger`) and, below it,
 * `select-popup`, gated `when: { popup: "open" }` — the shape `menu.figma.contract.ts` uses.
 */
export const selectFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "select",
  componentName: "Select",
  rootPart: "select-root",
  parts: [
    "select-root",
    "select-trigger",
    "select-value",
    "select-icon",
    "select-popup",
    "select-item",
    "select-item-text",
    "select-item-indicator",
    "select-separator",
    "select-group",
    "select-group-label",
  ],
  slots: [
    { name: "value", part: "select-value", required: true },
    { name: "item-text", part: "select-item-text", required: true },
    { name: "group-label", part: "select-group-label" },
    // Every icon part is a native slot — declared explicitly here
    // (never synthesized by the walker).
    { name: "caret", part: "select-icon" },
    { name: "item-check", part: "select-item-indicator" },
  ],
  anatomy: {
    part: "select-root",
    kind: "frame",
    layout: "vertical",
    synthetic: true,
    children: [
      {
        part: "select-trigger",
        kind: "frame",
        layout: "horizontal",
        children: [
          { part: "select-value", kind: "text", slots: ["value"], requiredBindings: ["textStyle"] },
          { part: "select-icon", kind: "icon", iconName: "CaretDown", slots: ["caret"] },
        ],
      },
      {
        part: "select-popup",
        kind: "frame",
        layout: "vertical",
        when: { popup: "open" },
        children: [
          {
            part: "select-group",
            kind: "frame",
            layout: "vertical",
            children: [
              {
                part: "select-group-label",
                kind: "text",
                slots: ["group-label"],
                requiredBindings: ["textStyle"],
              },
              {
                part: "select-item",
                kind: "frame",
                layout: "horizontal",
                children: [
                  {
                    part: "select-item-text",
                    kind: "text",
                    slots: ["item-text"],
                    requiredBindings: ["textStyle"],
                  },
                  {
                    part: "select-item-indicator",
                    kind: "icon",
                    iconName: "Check",
                    when: { selected: "selected" },
                    slots: ["item-check"],
                  },
                ],
              },
            ],
          },
          { part: "select-separator", kind: "rectangle" },
        ],
      },
    ],
  },
  // The item is a Building Block: its own states (selected, highlighted, disabled) multiply inside
  // the hidden `.Building Blocks/Select/Item` set, not in the trigger's set.
  buildingBlocks: [
    {
      part: "select-item",
      axes: [
        {
          prop: "selected",
          values: ["unselected", "selected"],
          default: "unselected",
          attribute: "data-selected",
          valueSelectors: { unselected: null, selected: "[data-selected]" },
        },
        {
          prop: "highlighted",
          values: ["idle", "highlighted"],
          default: "idle",
          attribute: "data-highlighted",
          valueSelectors: { idle: null, highlighted: "[data-highlighted]" },
        },
        {
          prop: "disabled",
          values: ["enabled", "disabled"],
          default: "enabled",
          attribute: "data-disabled",
          valueSelectors: { enabled: null, disabled: "[data-disabled]" },
        },
      ],
    },
  ],
  axes: [
    {
      prop: "popup",
      values: ["closed", "open"],
      default: "closed",
      attribute: "data-popup",
      valueSelectors: { closed: null, open: "[data-popup-open]" },
    },
    {
      prop: "state",
      values: ["default", "hover", "focus-visible", "disabled"],
      default: "default",
      attribute: "data-state",
      valueSelectors: {
        default: null,
        hover: ":hover",
        "focus-visible": ":focus-visible",
        disabled: "[data-disabled]",
      },
    },
  ],
  literalGeometry: [{ part: "select-icon", width: 16, height: 16 }],
  documentation: {
    coverage: "all-axes" as const,
    examples: [
      {
        label: "Small closed",
        key: { size: "sm" },
        slots: { value: "Choose a role", "item-text": "Designer" },
      },
      {
        label: "Medium open focused",
        key: { popup: "open", state: "focus-visible" },
        slots: {
          value: "Designer",
          "item-text": "Designer",
          "group-label": "Roles",
        },
      },
      {
        label: "Large open",
        key: { size: "lg", popup: "open" },
        slots: { value: "Choose a role", "item-text": "Engineer" },
      },
      {
        label: "Disabled",
        key: { state: "disabled" },
        slots: { value: "Designer", "item-text": "Designer" },
      },
      {
        label: "Hover",
        key: { state: "hover" },
        slots: { value: "Designer", "item-text": "Designer" },
      },
    ],
  },
  reactToFigmaNotes: [
    "select-root is a synthetic, unpainted vertical root (no data-ui source part) holding " +
      "select-trigger, the real, styled field surface, and below it select-popup, gated " +
      '`when: { popup: "open" }`. The browser places the popup under its anchor, so an ' +
      "open variant stacks the two; a closed variant holds the field alone. Same shape as " +
      "menu.figma.contract.ts. The field's fill, border and radius bind on the field part. " +
      "No positioning fields are declared.",
    "Popup and state flatten Base UI runtime states into design variants of the trigger. The item " +
      "is the `select-item` Building Block, whose selected, highlighted and disabled states are " +
      "its own variants; the popup holds an instance of it.",
  ],
});
