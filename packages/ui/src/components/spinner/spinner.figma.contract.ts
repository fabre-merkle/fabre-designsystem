import { defineFigmaContract } from "../figma-contract";

const SIZES = ["xs", "sm", "md", "lg"] as const;

export const spinnerFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "spinner",
  componentName: "Spinner",
  rootPart: "spinner",
  parts: ["spinner", "spinner-track", "spinner-arc"],
  anatomy: {
    part: "spinner",
    kind: "frame",
    layout: "overlay",
    children: [
      { part: "spinner-track", kind: "ellipse" },
      {
        // A quarter of the ring from 12 o'clock: `stroke-dasharray: 25 100` on a circle with
        // `pathLength="100"` is 25% of the circumference, i.e. 90 degrees. Its stroke is
        // `currentColor`, resolved to the spinner's text colour: only `tone="brand"` binds one,
        // so no stroke is required (`current` inherits from the surrounding control).
        part: "spinner-arc",
        kind: "ellipse",
        arc: { sweep: 90 },
      },
    ],
  },
  omittedParts: {
    "spinner-svg":
      "The `<svg>` viewport is structural: it paints nothing and fills the root (`100%`), so the " +
      "root frame stands in for it.",
  },
  documentation: {
    coverage: "all-axes" as const,
    examples: [
      ...SIZES.map((size) => ({
        label: `Current ${size}`,
        key: { size },
      })),
      { label: "Brand md", key: { tone: "brand" } },
    ],
  },
  reactToFigmaNotes: [
    "`size` maps to the React `size` prop and the `--control-icon-*` scale. The Figma default " +
      "is the React default (`md`).",
    "`tone` maps to the React `tone` prop. It colours only the arc: `brand` binds " +
      "`color/primary/onSurface/subtle` on the root and the arc's `currentColor` stroke follows it. " +
      "`current` inherits the surrounding control's text colour, which a component set does not " +
      "have, so the compiler binds the documentation theme's body text role (`color/onSurface`) on " +
      "the cell instead. " +
      "The arc is the contract's `arc` (90 degrees from 12 o'clock, the `stroke-dasharray: 25 100` " +
      "quarter), drawn as an open stroked ellipse arc.",
    'The Base UI Progress root renders `role="progressbar"` held indeterminate (`value={null}`); ' +
      "rotation and the reduced-motion pulse are runtime motion, not design variants.",
  ],
});
