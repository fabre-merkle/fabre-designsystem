import { defineFigmaContract } from "../figma-contract";

export const inputFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "input",
  componentName: "Input",
  rootPart: "input",
  parts: ["input"],
  slots: [
    { name: "value", part: "input" },
    { name: "placeholder", part: "input" },
  ],
  anatomy: {
    part: "input",
    kind: "frame",
    layout: "horizontal",
    slots: ["value", "placeholder"],
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
      values: ["default", "hover", "focus-visible", "disabled"],
      default: "default",
      attribute: "data-state",
      valueSelectors: {
        default: null,
        hover: ":hover",
        "focus-visible": ":focus-visible",
        disabled: "[data-disabled]",
      },
      codeProps: { disabled: { prop: "disabled", value: true } },
    },
  ],
  documentation: {
    coverage: "all-axes" as const,
    examples: [
      {
        label: "Empty",
        key: { size: "sm" },
        slots: { placeholder: "Email address" },
      },
      {
        label: "Focused value",
        key: { state: "focus-visible" },
        slots: { value: "designer@example.com" },
      },
      {
        label: "Invalid disabled",
        key: { size: "lg", validity: "invalid", state: "disabled" },
        slots: { value: "invalid address" },
      },
      {
        label: "Hover",
        key: { state: "hover" },
        slots: { value: "invalid address" },
      },
    ],
  },
  reactToFigmaNotes: [
    "Size matches the Button of the same size; validity and state (hover, focus-visible, disabled) flatten runtime input states into design variants.",
  ],
});
