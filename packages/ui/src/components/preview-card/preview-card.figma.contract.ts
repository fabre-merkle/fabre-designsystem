import { defineFigmaContract } from "../figma-contract";

export const previewCardFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "preview-card",
  componentName: "PreviewCard",
  rootPart: "preview-card-popup",
  parts: ["preview-card-popup"],
  slots: [{ name: "content", part: "preview-card-popup", required: true }],
  anatomy: {
    part: "preview-card-popup",
    kind: "frame",
    layout: "vertical",
    slots: ["content"],
    requiredBindings: ["fill", "text"],
  },
  axes: [],
  omittedParts: {
    "preview-card-arrow":
      "Its along-edge position is set by Base UI/Floating UI at runtime (inline transform), never " +
      "by CSS, and it is a DOM child of preview-card-popup's real auto-layout flow — generating it " +
      "would either misplace it at the parent's origin or inflate/misalign the popup like a tabs indicator. See reactToFigmaNotes below for the full reasoning.",
  },
  documentation: {
    coverage: "all-axes" as const,
    examples: [
      {
        label: "Default",
        key: {},
        slots: { content: "@designer\nSenior Product Designer at Acme" },
      },
    ],
  },
  reactToFigmaNotes: [
    "preview-card-popup has no CSS-authored typography (`textStyle`) — unlike Popover/Tooltip, " +
      "PreviewCard's stylesheet only carries layout/paint (padding, background, shadow, `color`); " +
      "the consumer supplies fully-styled content (their own text/heading components) inside the " +
      "popup. Only fill + text-colour bindings are required here; a textStyle requirement would be " +
      "a fabricated binding with nothing in the CSS to derive it from.",
    "PreviewCard has no design-facing axes: side/align only rotate the arrow (see below) and never " +
      "change the popup's own paint or geometry, and the open/closed transition is a runtime mount " +
      "concern, not a stylable variant — so this contract documents the single shown state.",
    "preview-card-trigger is a `data-slot` render-target with no `data-ui` and no co-located CSS — " +
      "PreviewCard never styles the trigger, which is an arbitrary consumer element (typically another library component, e.g. a link or avatar). Unlike Select (which owns and styles its " +
      "own trigger), there is no CSS to derive a Figma part from, so trigger+popup composition is " +
      "not representable as an anatomy node without inventing geometry; it is left undocumented " +
      "here rather than faked.",
    "preview-card-arrow is intentionally NOT a declared part. Its size/rotation are CSS-derivable, " +
      "but its position along the popup's edge is set by Base UI at runtime via Floating UI " +
      "middleware (inline transform), never by CSS — the same runtime-only placement gap as Slider's thumb/indicator. Unlike Slider, the arrow is also a DOM child of " +
      "`preview-card-popup`, whose own CSS is `display:flex;flex-direction:column` for real reasons " +
      '(stacking richer preview content) — declaring the popup `layout: "overlay"` to host the ' +
      "arrow would be dishonest (rule 0/1 of skill-contribute-component: overlay is for a parent whose " +
      "OWN children are absolutely positioned, not an ancestor with mixed flow/runtime children), " +
      "and generating the arrow as an ordinary flow child would inflate/misplace the popup the way it would for `tabs-indicator`. Omitting it is the honest choice (a guessed position is worse than a refusal) until a declarative along-axis placement exists.",
    "preview-card-backdrop is a `data-slot` render-target with no co-located CSS in this component " +
      "(no modal scrim styling) — nothing to represent.",
  ],
});
