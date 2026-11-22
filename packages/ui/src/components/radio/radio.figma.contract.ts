import { defineFigmaContract } from "../figma-contract";

export const radioFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "radio",
  componentName: "Radio",
  rootPart: "radio",
  parts: ["radio", "radio-indicator"],
  anatomy: {
    part: "radio",
    kind: "frame",
    // The radio is a flex row that centres its dot on both axes (`justify-content` and
    // `align-items: center`), so the dot is a flow child and the parent's alignment centres it.
    layout: "horizontal",
    children: [
      {
        part: "radio-indicator",
        kind: "ellipse",
        when: { checked: "checked" },
      },
    ],
  },
  axes: [
    {
      prop: "checked",
      values: ["unchecked", "checked"],
      default: "unchecked",
      attribute: "data-checked",
      valueSelectors: { unchecked: null, checked: "[data-checked]" },
    },
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
        label: "Unselected",
        key: {},
      },
      {
        label: "Selected",
        key: { checked: "checked", state: "focus-visible" },
      },
      {
        label: "Invalid disabled",
        key: { checked: "checked", validity: "invalid", state: "disabled" },
      },
      {
        label: "Hover",
        key: { state: "hover" },
      },
    ],
  },
  reactToFigmaNotes: [
    "Checked, validity, and state (hover, focus-visible, disabled) flatten Base UI runtime states into design variants.",
  ],
});
