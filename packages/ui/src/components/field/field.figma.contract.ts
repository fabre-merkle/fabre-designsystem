import { defineFigmaContract } from "../figma-contract";

export const fieldFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "field",
  componentName: "Field",
  rootPart: "field",
  parts: ["field", "field-label", "field-control", "field-description", "field-error"],
  slots: [
    { name: "label", part: "field-label", required: true },
    // Composition: `field.css` never
    // mentions `control` — border, padding and focus ring are all `Input`'s
    // own CSS. The docs preview always composes `<Field>` WITH an `<Input>`;
    // this declares that composition instead of filling the slot with the
    // literal string `"designer@example.com"`.
    {
      name: "control",
      part: "field-control",
      required: true,
      composedChild: { component: "input" },
    },
    { name: "description", part: "field-description" },
    { name: "error", part: "field-error" },
  ],
  anatomy: {
    part: "field",
    kind: "frame",
    layout: "vertical",
    children: [
      { part: "field-label", kind: "text", slots: ["label"], requiredBindings: ["textStyle"] },
      { part: "field-control", kind: "frame", layout: "horizontal", slots: ["control"] },
      {
        part: "field-description",
        kind: "text",
        slots: ["description"],
        when: { validity: "valid" },
        requiredBindings: ["textStyle"],
      },
      {
        part: "field-error",
        kind: "text",
        slots: ["error"],
        when: { validity: "invalid" },
        requiredBindings: ["textStyle"],
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
      values: ["default", "disabled"],
      default: "default",
      attribute: "data-state",
      valueSelectors: {
        default: null,
        disabled: "[data-disabled]",
      },
    },
  ],
  documentation: {
    coverage: "all-axes" as const,
    examples: [
      {
        label: "Labeled field",
        key: {},
        slots: {
          label: "Email address",
          description: "We only use this to contact you about your account.",
        },
      },
      {
        label: "Invalid field",
        key: { validity: "invalid" },
        slots: {
          label: "Email address",
          error: "Enter a valid email address.",
        },
      },
      {
        label: "Disabled field",
        key: { state: "disabled" },
        slots: { label: "Account email" },
      },
    ],
  },
  reactToFigmaNotes: ["Validity and state flatten runtime field context into design variants."],
});
