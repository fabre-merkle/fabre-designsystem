import { defineFigmaContract } from "../figma-contract";

export const badgeFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "badge",
  componentName: "Badge",
  rootPart: "badge",
  parts: ["badge"],
  // One set per mode ("Filled Badge", "Light Badge", "Stroke Badge"), each holding size x tone.
  // Colour stays a variant axis: it is never moved into variable modes.
  split: { axis: "mode" },
  literalGeometry: [{ part: "badge", lineHeight: 1, lineHeightUnit: "unitless" }],
  documentation: {
    coverage: "all-axes" as const,
    examples: [
      { label: "Neutral filled", key: { size: "sm" } },
      { label: "Info light", key: { tone: "info", mode: "light" } },
      { label: "Success stroke", key: { tone: "success", mode: "stroke", size: "lg" } },
      { label: "Warning filled", key: { tone: "warning" } },
      { label: "Critical light", key: { tone: "critical", mode: "light" } },
    ],
  },
});
