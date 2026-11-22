import { defineFigmaContract } from "../figma-contract";

export const meterFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "meter",
  componentName: "Meter",
  rootPart: "meter",
  parts: ["meter", "meter-header", "meter-label", "meter-value", "meter-track", "meter-indicator"],
  slots: [
    { name: "label", part: "meter-label", required: true },
    { name: "value", part: "meter-value", required: true },
  ],
  runtimeValues: [
    {
      name: "fill",
      part: "meter-indicator",
      measures: "length" as const,
      replaces: [],
      reason:
        "Base UI sets the indicator's inline-size from the meter's value as an inline style at runtime, so the stylesheet has no length to derive. Each example declares the filled share of the track as a percent. Authored, not measured.",
    },
  ],
  anatomy: {
    part: "meter",
    kind: "frame",
    layout: "vertical",
    children: [
      {
        // `meter.css` lays the label and the value on one grid row (`1fr auto`) and
        // spans the track across both columns. A grid row is not a node the walker
        // can derive, so the row is a synthetic horizontal container that pushes the
        // value to the far edge, the way the docs markup places them side by side.
        part: "meter-header",
        kind: "frame",
        layout: "horizontal",
        synthetic: true,
        docsLayout: {
          gap: "var(--spacing-200)",
          justify: "space-between",
          align: "center",
          source: "apps/docs/content/docs/components/meter.mdx:100",
        },
        children: [
          { part: "meter-label", kind: "text", slots: ["label"], requiredBindings: ["text"] },
          { part: "meter-value", kind: "text", slots: ["value"], requiredBindings: ["text"] },
        ],
      },
      {
        part: "meter-track",
        kind: "frame",
        layout: "overlay",
        requiredBindings: ["fill"],
        children: [
          {
            part: "meter-indicator",
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
  literalGeometry: [
    { part: "meter-track", when: { size: "sm" }, height: 4 },
    { part: "meter-track", when: { size: "md" }, height: 8 },
    { part: "meter-track", when: { size: "lg" }, height: 12 },
  ],
  documentation: {
    coverage: "all-axes" as const,
    examples: [
      {
        label: "Neutral small",
        key: { size: "sm" },
        slots: { label: "Storage used", value: "25%" },
        runtimeValues: { fill: "25" },
      },
      {
        label: "Success medium",
        key: { tone: "success" },
        slots: { label: "Storage used", value: "64%" },
        runtimeValues: { fill: "64" },
      },
      {
        label: "Warning large",
        key: { size: "lg", tone: "warning" },
        slots: { label: "Storage used", value: "80%" },
        runtimeValues: { fill: "80" },
      },
      {
        label: "Critical medium",
        key: { tone: "critical" },
        slots: { label: "Storage used", value: "92%" },
        runtimeValues: { fill: "92" },
      },
    ],
  },
});
