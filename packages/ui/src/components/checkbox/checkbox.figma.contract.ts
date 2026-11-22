import { defineFigmaContract } from "../figma-contract";

export const checkboxFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "checkbox",
  componentName: "Checkbox",
  rootPart: "checkbox",
  parts: ["checkbox", "checkbox-indicator", "checkbox-check", "checkbox-minus"],
  // Every icon part is a native slot — declared explicitly here
  // (never synthesized by the walker).
  slots: [
    { name: "check-icon", part: "checkbox-check" },
    { name: "minus-icon", part: "checkbox-minus" },
  ],
  anatomy: {
    part: "checkbox",
    kind: "frame",
    // The box and its indicator are flex rows that centre their content on both axes
    // (`justify-content` and `align-items: center`), so each level is a flow child and its parent's
    // alignment centres it: no overlay and no literal offsets.
    layout: "horizontal",
    children: [
      {
        part: "checkbox-indicator",
        kind: "frame",
        layout: "horizontal",
        children: [
          {
            part: "checkbox-check",
            kind: "icon",
            iconName: "Check",
            when: { checked: "checked" },
            slots: ["check-icon"],
          },
          {
            part: "checkbox-minus",
            kind: "icon",
            iconName: "Minus",
            when: { checked: "indeterminate" },
            slots: ["minus-icon"],
          },
        ],
      },
    ],
  },
  axes: [
    {
      prop: "checked",
      values: ["unchecked", "checked", "indeterminate"],
      default: "unchecked",
      attribute: "data-checked",
      valueSelectors: {
        unchecked: null,
        checked: "[data-checked]",
        indeterminate: "[data-indeterminate]",
      },
      codeProps: {
        checked: { prop: "checked", value: true },
        indeterminate: { prop: "indeterminate", value: true },
      },
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
        label: "Unchecked",
        key: {},
      },
      {
        label: "Checked",
        key: { checked: "checked", state: "focus-visible" },
      },
      {
        label: "Indeterminate",
        key: { checked: "indeterminate" },
      },
      {
        label: "Hover",
        key: { state: "hover" },
      },
      {
        label: "Invalid disabled",
        key: { checked: "checked", validity: "invalid", state: "disabled" },
      },
    ],
  },
  reactToFigmaNotes: [
    "Checked and validity flatten Base UI runtime states into design variants. State is the standard " +
      "design-only axis: `disabled` is the React disabled prop; `hover` and `focus-visible` are browser states with no prop to set.",
  ],
});
