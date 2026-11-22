import { defineFigmaContract } from "../figma-contract";

export const fieldsetFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "fieldset",
  componentName: "Fieldset",
  rootPart: "fieldset",
  parts: ["fieldset", "fieldset-legend", "fieldset-item"],
  // fieldset.css styles the root layout (column flex + gap, no paint) and the
  // legend's own typography/colour — those two are real, CSS-resolvable parts.
  // Fieldset has no part for the fields it wraps; the docs example
  // (fieldset.mdx) always composes real `Field` instances as children. Each
  // item is therefore a COMPOSED CHILD (a Field instance) — the same
  // pattern toggle-group uses for Toggle and field uses for Input — rather
  // than a re-drawn label+control row.
  slots: [
    { name: "legend", part: "fieldset-legend", required: true },
    {
      name: "item",
      part: "fieldset-item",
      required: true,
      composedChild: { component: "field" },
    },
  ],
  anatomy: {
    part: "fieldset",
    kind: "frame",
    layout: "vertical",
    children: [
      {
        part: "fieldset-legend",
        kind: "text",
        slots: ["legend"],
        requiredBindings: ["textStyle"],
      },
      {
        part: "fieldset-item",
        kind: "frame",
        layout: "vertical",
        synthetic: true,
        repeat: 2,
        slots: ["item"],
      },
    ],
  },
  axes: [],
  documentation: {
    coverage: "all-axes" as const,
    examples: [
      {
        label: "Billing contact",
        key: {},
        slots: { legend: "Billing contact" },
      },
    ],
  },
  reactToFigmaNotes: [
    "Fieldset has no design-facing axes of its own — Base UI Fieldset renders no data-state; " +
      "disabled state is a per-Field concern (see field.figma.contract.ts), not a Fieldset variant.",
    "Each item's default content is a Field instance, itself composing an Input " +
      "instance (field.figma.contract.ts) — editing Field or Input propagates to every Fieldset " +
      "that composes them.",
    "fieldset-item is a synthetic wrapper: fieldset.css has no part for the fields it wraps — the " +
      "docs example (fieldset.mdx) always composes real Field children, never literal content.",
  ],
});
