import { defineFigmaContract } from "../figma-contract";

export const checkboxGroupFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "checkbox-group",
  componentName: "CheckboxGroup",
  rootPart: "checkbox-group",
  parts: [
    "checkbox-group",
    "checkbox-group-item",
    "checkbox-group-control",
    "checkbox-group-label",
  ],
  // checkbox-group.css declares layout only (column flex + gap) — no fill/text/stroke/
  // effectStyle anywhere. Its entire visual identity is delegated to the Checkbox children
  // it coordinates, which is exactly the composed-only-wrapper exception:
  // compileGenerationContract skips the own-CSS-binding requirement
  // for a contract with genuinely no paint/text CSS AND a required composed child that is
  // already-contracted component. There is no library-owned row part: each item row
  // is a synthetic frame holding a COMPOSED CHILD (Checkbox instance, the same pattern toggle-group uses for
  // Toggle) and a FieldLabel instance. The docs write the row's text as `Field.Label`, whose
  // typography and colour live in field.css, so the label composes `field-label` (a component built
  // from Field's stylesheet) instead of carrying hand-set text.
  slots: [
    {
      name: "item",
      part: "checkbox-group-control",
      required: true,
      composedChild: { component: "checkbox" },
    },
    // The docs row wraps the control and its text in a `Field.Label`, so the label is a FieldLabel
    // instance and its typography comes from Field's stylesheet.
    {
      name: "label",
      part: "checkbox-group-label",
      composedChild: { component: "field-label" },
    },
  ],
  anatomy: {
    part: "checkbox-group",
    kind: "frame",
    layout: "vertical",
    children: [
      {
        // One row per `<label>` in the docs example: the Checkbox beside its text, centred on the
        // row (`alignItems: "center"` in the docs markup). The docs' 0.5rem gap is a literal, not a
        // token, so it is not reproduced (the same rule docsLayout applies to any literal gap).
        part: "checkbox-group-item",
        kind: "frame",
        layout: "horizontal",
        synthetic: true,
        docsLayout: {
          align: "center",
          source: "apps/docs/content/docs/components/checkbox-group.mdx:10",
        },
        items: [
          { slots: { label: "Email" } },
          { slots: { label: "SMS" } },
          { slots: { label: "Push" } },
        ],
        children: [
          {
            part: "checkbox-group-control",
            kind: "frame",
            layout: "horizontal",
            synthetic: true,
            slots: ["item"],
          },
          {
            part: "checkbox-group-label",
            kind: "frame",
            layout: "horizontal",
            synthetic: true,
            slots: ["label"],
          },
        ],
      },
    ],
  },
  axes: [],
  documentation: {
    coverage: "all-axes" as const,
    examples: [{ label: "Default", key: {} }],
  },
  reactToFigmaNotes: [
    "CheckboxGroup has no design-facing axes of its own — value/defaultValue/onValueChange/" +
      "allValues/disabled are runtime coordination concerns, not visual variants; disabled " +
      "state renders on each composed Checkbox instance (checkbox.figma.contract.ts), not the group.",
    "Each item's default content is a Checkbox instance: editing Checkbox " +
      "propagates to every CheckboxGroup that composes it.",
    "The docs example wraps each Checkbox in a `Field.Label`. Each row is a synthetic frame with the Checkbox instance and a FieldLabel instance (field-label.figma.contract.ts, built from Field's stylesheet), so the label's text style and colour are Field's. Each row's text is the docs example's, set on the instance (`items[].slots`); the instance stays linked to FieldLabel.",
    "checkbox-group.css has no paint/text CSS of its own — the composed-only-wrapper exception " +
      "(the compiler's isComposedOnlyWrapper check) allows this contract to compile without an own " +
      "CSS-derived binding because its only required slot composes an already-contracted component.",
  ],
});
