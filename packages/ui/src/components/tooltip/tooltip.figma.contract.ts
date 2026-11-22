import { defineFigmaContract } from "../figma-contract";

export const tooltipFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "tooltip",
  componentName: "Tooltip",
  rootPart: "tooltip-popup",
  parts: ["tooltip-popup"],
  slots: [{ name: "content", part: "tooltip-popup", required: true }],
  anatomy: {
    part: "tooltip-popup",
    kind: "frame",
    slots: ["content"],
    requiredBindings: ["fill", "text", "textStyle"],
  },
  axes: [],
  omittedParts: {
    "tooltip-arrow":
      "Its along-edge position is set by Base UI/Floating UI at runtime (inline transform), never " +
      "by CSS, and it is a DOM child of tooltip-popup's real auto-layout flow — generating it would " +
      "either misplace it at the parent's origin or inflate/misalign the popup like a tabs indicator. See reactToFigmaNotes below for the full reasoning.",
  },
  documentation: {
    coverage: "all-axes" as const,
    examples: [{ label: "Default", key: {}, slots: { content: "Saved to your drafts" } }],
  },
  reactToFigmaNotes: [
    "Tooltip has no design-facing axes: side/align only rotate the arrow (see below) and never " +
      "change the popup's own paint or geometry, and the open/closed transition is a runtime " +
      "mount concern, not a stylable variant — so this contract documents the single shown state.",
    "tooltip-trigger is a `data-slot` render-target with no `data-ui` and no co-located CSS — " +
      "Tooltip never styles the trigger, which is an arbitrary consumer element (typically another library component, e.g. Button). Unlike Select (which owns and styles its own trigger), there " +
      "is no CSS to derive a Figma part from, so trigger+popup composition is not representable as " +
      "an anatomy node without inventing geometry; it is left undocumented here rather than faked.",
    "tooltip-arrow is intentionally NOT a declared part. Its size/rotation are CSS-derivable, but " +
      "its position along the popup's edge is set by Base UI at runtime via Floating UI middleware " +
      "(inline transform), never by CSS — the same runtime-only placement gap as Slider's thumb/indicator. Unlike Slider, the arrow is also a DOM child of `tooltip-popup`, " +
      "whose own CSS is `display:flex;flex-direction:column` for real reasons (stacking future " +
      'content) — declaring the popup `layout: "overlay"` to host the arrow would be dishonest ' +
      "(rule 0/1 of skill-contribute-component: overlay is for a parent whose OWN children are " +
      "absolutely positioned, not an ancestor with mixed flow/runtime children), and generating the " +
      "arrow as an ordinary flow child would inflate/misplace the popup the way it would for `tabs-indicator`. Omitting it is the honest choice (a guessed position is worse than a refusal) until a declarative along-axis placement exists.",
  ],
});
