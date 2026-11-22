import { defineFigmaContract } from "../figma-contract";

/**
 * `Field.Label` as a component of its own. The part has no component folder: its stylesheet and
 * source are Field's (`source`), and its typography and colour come from `field.css`. Other
 * contracts compose it where the code writes a `Field.Label` (a checkbox row, a drawer checklist).
 */
export const fieldLabelFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "field-label",
  componentName: "FieldLabel",
  source: { slug: "field" },
  rootPart: "field-label",
  parts: ["field-label"],
  slots: [{ name: "label", part: "field-label", required: true, codeProp: "children" }],
  anatomy: {
    part: "field-label",
    kind: "text",
    slots: ["label"],
    requiredBindings: ["textStyle"],
  },
  axes: [],
  documentation: {
    coverage: "all-axes" as const,
    examples: [{ label: "Default", key: {}, slots: { label: "Label" } }],
  },
  reactToFigmaNotes: [
    "FieldLabel is the Field.Label part, generated as its own component so a checkbox row or a checklist can compose it. Its text style and colour come from the Field stylesheet.",
  ],
});
