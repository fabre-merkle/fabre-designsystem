import { defineFigmaContract } from "../figma-contract";

export const numberFieldFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "number-field",
  componentName: "NumberField",
  rootPart: "number-field",
  parts: [
    "number-field",
    "number-field-group",
    "number-field-input",
    "number-field-increment",
    "number-field-decrement",
    "number-field-scrub-area",
    "number-field-scrub-area-cursor",
  ],
  slots: [
    { name: "value", part: "number-field-input", required: true },
    { name: "increment", part: "number-field-increment" },
    { name: "decrement", part: "number-field-decrement" },
    { name: "scrub-label", part: "number-field-scrub-area" },
    { name: "scrub-cursor", part: "number-field-scrub-area-cursor" },
  ],
  anatomy: {
    part: "number-field",
    kind: "frame",
    layout: "vertical",
    children: [
      {
        part: "number-field-scrub-area",
        kind: "frame",
        layout: "horizontal",
        slots: ["scrub-label"],
        children: [
          {
            part: "number-field-scrub-area-cursor",
            kind: "text",
            slots: ["scrub-cursor"],
            when: { state: "active" },
          },
        ],
      },
      {
        part: "number-field-group",
        kind: "frame",
        layout: "horizontal",
        children: [
          {
            part: "number-field-decrement",
            kind: "frame",
            layout: "horizontal",
            slots: ["decrement"],
          },
          { part: "number-field-input", kind: "text", slots: ["value"] },
          {
            part: "number-field-increment",
            kind: "frame",
            layout: "horizontal",
            slots: ["increment"],
          },
        ],
      },
    ],
  },
  axes: [
    {
      prop: "validity",
      values: ["valid", "invalid"],
      default: "valid",
      attribute: "data-validity",
      valueSelectors: { valid: null, invalid: "[data-invalid]" },
    },
    {
      prop: "state",
      values: ["default", "hover", "active", "focus-visible", "disabled"],
      default: "default",
      attribute: "data-state",
      valueSelectors: {
        default: null,
        hover: ":hover",
        active: "[data-scrubbing]",
        "focus-visible": ":focus-within",
        disabled: "[data-disabled]",
      },
    },
  ],
  documentation: {
    coverage: "all-axes" as const,
    examples: [
      {
        label: "Small",
        key: { size: "sm" },
        slots: { value: "1", decrement: "−", increment: "+" },
      },
      {
        label: "Medium focused",
        key: { state: "focus-visible" },
        slots: { value: "42", decrement: "−", increment: "+" },
      },
      {
        label: "Large scrubbing",
        key: { size: "lg", state: "active" },
        slots: { value: "100", "scrub-label": "Opacity", "scrub-cursor": "↔" },
      },
      {
        label: "Invalid disabled",
        key: { validity: "invalid", state: "disabled" },
        slots: { value: "0", decrement: "−", increment: "+" },
      },
      {
        label: "Hover",
        key: { state: "hover" },
        slots: { value: "0", decrement: "−", increment: "+" },
      },
    ],
  },
  reactToFigmaNotes: [
    "Validity and state (hover, active, focus-visible, disabled) flatten Base UI runtime states into design variants.",
  ],
});
