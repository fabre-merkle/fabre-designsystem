import { defineFigmaContract } from "../figma-contract";

export const otpFieldFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "otp-field",
  componentName: "OTPField",
  rootPart: "otp-field",
  parts: ["otp-field", "otp-field-input", "otp-field-separator"],
  // One set per validity ("Valid OTPField", "Invalid OTPField"), each holding
  // completion x entry x state.
  split: { axis: "validity" },
  slots: [{ name: "digit", part: "otp-field-input", required: true }],
  runtimeValues: [
    {
      name: "separator-position",
      part: "otp-field-separator",
      measures: "travel" as const,
      replaces: [],
      reason:
        "The docs example puts the separator between cells 3 and 4 (`OTPFieldInput` 0-2, " +
        "`OTPFieldSeparator`, 3-5). A contract anatomy cannot place one part between two runs of " +
        "another (a part materializes once, and `repeat` is one unbroken run), so the separator is " +
        "taken out of the flow and placed at the midpoint of the row: 50 is the free-space " +
        "midpoint, which is the gap between the two groups. Authored, not measured.",
    },
  ],
  anatomy: {
    part: "otp-field",
    kind: "frame",
    layout: "horizontal",
    children: [
      { part: "otp-field-input", kind: "frame", slots: ["digit"], repeat: 6 },
      // A bar painted by CSS (`inline-size`, `block-size`, `background-color`), not a glyph, so
      // it is a rectangle. Out of the flow and centred on the row, between the two groups of three.
      {
        part: "otp-field-separator",
        kind: "rectangle",
        requiredBindings: ["fill"],
        removeFromFlow: true,
        positionAlongMain: { kind: "valueOf", runtimeValue: "separator-position" },
        overlayCrossAlign: "center",
        reason:
          "otp-field.css lays the separator out as a flex item between the second and third " +
          "cells. A part cannot be materialized twice and a `repeat` is one unbroken run, so the " +
          "cells cannot be authored as two groups with the separator between them. The separator " +
          "is taken out of the flow and placed at the declared midpoint of the row, centred on the " +
          "cross axis. It overlaps the 2px of each neighbouring cell edge that the real flex gap " +
          "would leave clear.",
      },
    ],
  },
  axes: [
    {
      prop: "completion",
      values: ["incomplete", "complete"],
      default: "incomplete",
      attribute: "data-completion",
      valueSelectors: { incomplete: null, complete: "[data-complete]" },
    },
    {
      prop: "entry",
      values: ["empty", "filled"],
      default: "empty",
      attribute: "data-entry",
      valueSelectors: { empty: null, filled: "[data-filled]" },
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
    },
  ],
  literalGeometry: [{ part: "otp-field-input", lineHeight: 1, lineHeightUnit: "unitless" }],
  documentation: {
    coverage: "all-axes" as const,
    examples: [
      {
        label: "Empty",
        key: {},
        slots: { digit: "" },
        runtimeValues: { "separator-position": "50" },
      },
      {
        label: "Filled focused",
        key: { entry: "filled", state: "focus-visible" },
        slots: { digit: "4" },
        runtimeValues: { "separator-position": "50" },
      },
      {
        label: "Complete",
        key: { completion: "complete", entry: "filled" },
        slots: { digit: "482916" },
        runtimeValues: { "separator-position": "50" },
      },
      {
        label: "Invalid disabled",
        key: { entry: "filled", validity: "invalid", state: "disabled" },
        slots: { digit: "4" },
        runtimeValues: { "separator-position": "50" },
      },
      {
        label: "Hover",
        key: { state: "hover" },
        slots: { digit: "4" },
        runtimeValues: { "separator-position": "50" },
      },
    ],
  },
  reactToFigmaNotes: [
    "Completion, entry, validity, and state (hover, focus-visible, disabled) flatten runtime OTP states into design variants.",
    "The separator is a CSS-painted bar, not a text glyph. It is placed at the midpoint of the row (declared runtime value `separator-position`) to sit between the two groups of three cells, because the anatomy cannot place one part between two runs of another.",
  ],
});
