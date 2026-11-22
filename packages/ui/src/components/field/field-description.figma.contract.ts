import { defineFigmaContract } from "../figma-contract";

/**
 * `Field.Description` as a component of its own, built from Field's stylesheet and source the same
 * way as `field-label`.
 */
export const fieldDescriptionFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "field-description",
  componentName: "FieldDescription",
  source: { slug: "field" },
  rootPart: "field-description",
  parts: ["field-description"],
  slots: [{ name: "description", part: "field-description", required: true, codeProp: "children" }],
  anatomy: {
    part: "field-description",
    kind: "text",
    slots: ["description"],
    requiredBindings: ["textStyle"],
  },
  axes: [],
  documentation: {
    coverage: "all-axes" as const,
    examples: [{ label: "Default", key: {}, slots: { description: "Helper text" } }],
  },
  reactToFigmaNotes: [
    "FieldDescription is the Field.Description part, generated as its own component so a checklist row can compose it. Its text style and colour come from the Field stylesheet.",
  ],
});
