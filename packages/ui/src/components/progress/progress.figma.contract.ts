import { defineFigmaContract } from "../figma-contract";

export const progressFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "progress",
  componentName: "Progress",
  rootPart: "progress",
  parts: [
    "progress",
    "progress-header",
    "progress-label",
    "progress-value",
    "progress-track",
    "progress-indicator",
  ],
  slots: [
    { name: "label", part: "progress-label", required: true },
    { name: "value", part: "progress-value", required: true },
  ],
  runtimeValues: [
    {
      name: "fill",
      part: "progress-indicator",
      measures: "length" as const,
      replaces: [],
      reason:
        "Base UI sets the indicator's inline-size from the progress value as an inline style at runtime (the indeterminate stripe is a fixed 40% in CSS, animated), so the stylesheet has no length to derive for a determinate bar. Each example declares the filled share of the track as a percent. Authored, not measured.",
    },
  ],
  anatomy: {
    part: "progress",
    kind: "frame",
    layout: "vertical",
    children: [
      {
        // `progress.css` lays the label and the value on one grid row (`1fr auto`) and
        // spans the track across both columns. A grid row is not a node the walker can
        // derive, so the row is a synthetic horizontal container that pushes the value
        // to the far edge, the way the docs markup places them side by side.
        part: "progress-header",
        kind: "frame",
        layout: "horizontal",
        synthetic: true,
        docsLayout: {
          gap: "var(--spacing-200)",
          justify: "space-between",
          align: "center",
          source: "apps/docs/content/docs/components/progress.mdx:99",
        },
        children: [
          { part: "progress-label", kind: "text", slots: ["label"], requiredBindings: ["text"] },
          { part: "progress-value", kind: "text", slots: ["value"], requiredBindings: ["text"] },
        ],
      },
      {
        part: "progress-track",
        kind: "frame",
        layout: "overlay",
        requiredBindings: ["fill"],
        children: [
          {
            part: "progress-indicator",
            kind: "rectangle",
            requiredBindings: ["fill"],
            // The filled part of the track is as thick as the track.
            overlayCrossAlign: "stretch",
            sizeAlongMain: { kind: "valueOf", runtimeValue: "fill" },
            reason:
              "The indicator's length has no CSS to derive from: Base UI sets it from the live value via inline style. Each documentation example declares the representative fill as a percent of the track, pinned at the track's start edge.",
          },
        ],
      },
    ],
  },
  axes: [
    {
      prop: "status",
      values: ["progressing", "complete", "indeterminate"],
      default: "progressing",
      attribute: "data-status",
      valueSelectors: {
        progressing: null,
        complete: '[data-status="complete"]',
        indeterminate: '[data-status="indeterminate"]',
      },
    },
  ],
  literalGeometry: [
    { part: "progress-track", when: { size: "sm" }, height: 4 },
    { part: "progress-track", when: { size: "md" }, height: 8 },
    { part: "progress-track", when: { size: "lg" }, height: 12 },
  ],
  documentation: {
    coverage: "all-axes" as const,
    examples: [
      {
        label: "Progressing small",
        key: { size: "sm" },
        slots: { label: "Uploading", value: "60%" },
        runtimeValues: { fill: "60" },
      },
      {
        label: "Complete medium",
        key: { status: "complete" },
        slots: { label: "Uploading", value: "100%" },
        runtimeValues: { fill: "100" },
      },
      {
        label: "Indeterminate large",
        key: { size: "lg", status: "indeterminate" },
        slots: { label: "Uploading", value: "Loading" },
        runtimeValues: { fill: "40" },
      },
    ],
  },
  reactToFigmaNotes: [
    "status flattens Base UI's data-status (progressing, complete, indeterminate) into a design axis. The indeterminate stripe's travel animation is not modelled; its example shows the 40% stripe at rest.",
  ],
});
