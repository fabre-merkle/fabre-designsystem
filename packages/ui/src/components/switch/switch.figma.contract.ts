import { defineFigmaContract } from "../figma-contract";

export const switchFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "switch",
  componentName: "Switch",
  rootPart: "switch",
  parts: ["switch", "switch-thumb"],
  anatomy: {
    part: "switch",
    kind: "frame",
    // The track is a flex row; the thumb is its flow child. The checked thumb's `translateX` to the
    // end edge becomes the track's `primaryAxisAlignItems: MAX` (`translate-to-align.ts`), not an offset.
    layout: "horizontal",
    children: [{ part: "switch-thumb", kind: "ellipse" }],
  },
  axes: [
    {
      prop: "checked",
      values: ["unchecked", "checked"],
      default: "unchecked",
      attribute: "data-checked",
      valueSelectors: { unchecked: null, checked: "[data-checked]" },
      codeProps: { checked: { prop: "checked", value: true } },
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
      values: ["default", "focus-visible", "disabled"],
      default: "default",
      attribute: "data-state",
      valueSelectors: {
        default: null,
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
        label: "Off",
        key: {},
      },
      {
        label: "On",
        key: { checked: "checked", state: "focus-visible" },
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
