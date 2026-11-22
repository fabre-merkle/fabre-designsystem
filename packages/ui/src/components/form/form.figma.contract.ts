import { defineFigmaContract } from "../figma-contract";

export const formFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "form",
  componentName: "Form",
  rootPart: "form",
  parts: ["form", "form-field", "form-submit"],
  // form.css declares layout only (column flex + gap) — no fill/text/stroke/effectStyle
  // anywhere. Its entire visual identity is delegated to the fields and submit control it
  // wraps, exactly the composed-only-wrapper exception:
  // compileGenerationContract skips the own-CSS-binding requirement for a contract
  // with genuinely no paint/text CSS AND a required composed child that is itself an
  // already-contracted component. form.mdx's Usage example is one Field.Root (with an Input
  // control, per field.figma.contract.ts) plus a submit Button — this anatomy composes
  // exactly that, real Field and Button instances rather than re-drawn rows.
  slots: [
    {
      name: "field",
      part: "form-field",
      required: true,
      composedChild: { component: "field" },
    },
    {
      name: "submit",
      part: "form-submit",
      required: true,
      composedChild: { component: "button" },
    },
  ],
  anatomy: {
    part: "form",
    kind: "frame",
    layout: "vertical",
    children: [
      {
        part: "form-field",
        kind: "frame",
        layout: "vertical",
        synthetic: true,
        slots: ["field"],
      },
      {
        part: "form-submit",
        kind: "frame",
        layout: "horizontal",
        synthetic: true,
        slots: ["submit"],
      },
    ],
  },
  axes: [],
  documentation: {
    coverage: "all-axes" as const,
    examples: [{ label: "Default", key: {} }],
  },
  reactToFigmaNotes: [
    "Form has no design-facing axes of its own — Base UI Form renders no data-state; " +
      "onSubmit/errors are runtime coordination concerns, not visual variants.",
    "The field's default content is a Field instance, itself composing an Input " +
      "instance (field.figma.contract.ts); the submit control's default content is a Button " +
      "instance (button.figma.contract.ts) at its own contract defaults (variant=primary) — " +
      "matching form.mdx's Usage example (one Field + a submit Button). Editing Field, Input, " +
      "or Button propagates to every Form that composes them.",
    "form.css has no paint/text CSS of its own — the composed-only-wrapper exception (the compiler's " +
      "isComposedOnlyWrapper check) allows this contract to compile without an own CSS-derived " +
      "binding because its required slots compose already-contracted components.",
  ],
});
