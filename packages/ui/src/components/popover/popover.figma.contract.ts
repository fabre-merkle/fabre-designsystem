import { defineFigmaContract } from "../figma-contract";

export const popoverFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "popover",
  componentName: "Popover",
  rootPart: "popover-popup",
  parts: ["popover-popup", "popover-title", "popover-description"],
  slots: [
    { name: "title", part: "popover-title", required: true },
    { name: "description", part: "popover-description", required: true },
  ],
  anatomy: {
    part: "popover-popup",
    kind: "frame",
    layout: "vertical",
    requiredBindings: ["fill"],
    children: [
      {
        part: "popover-title",
        kind: "text",
        slots: ["title"],
        requiredBindings: ["textStyle"],
      },
      {
        part: "popover-description",
        kind: "text",
        slots: ["description"],
        requiredBindings: ["textStyle"],
      },
    ],
  },
  axes: [],
  omittedParts: {
    "popover-arrow":
      "Its along-edge position is set by Base UI/Floating UI at runtime (inline transform), never " +
      "by CSS, and it is a DOM child of popover-popup's real title/description auto-layout flow — " +
      "generating it would either misplace it at the parent's origin or inflate/misalign the popup " +
      "like a tabs indicator. See reactToFigmaNotes below for the full reasoning.",
  },
  documentation: {
    coverage: "all-axes" as const,
    examples: [
      {
        label: "Default",
        key: {},
        slots: {
          title: "Notifications",
          description: "You have 3 unread messages.",
        },
      },
    ],
  },
  reactToFigmaNotes: [
    "Popover has no design-facing axes: side/align only rotate the arrow (see below) and never " +
      "change the popup's own paint or geometry, and the open/closed transition is a runtime mount " +
      "concern, not a stylable variant — so this contract documents the single shown state (title + " +
      "description).",
    "popover-trigger is a `data-slot` render-target with no `data-ui` and no co-located CSS — " +
      "Popover never styles the trigger, which is an arbitrary consumer element (typically another library component, e.g. Button). Unlike Select (which owns and styles its own trigger), there " +
      "is no CSS to derive a Figma part from, so trigger+popup composition is not representable as " +
      "an anatomy node without inventing geometry; it is left undocumented here rather than faked. " +
      "Same reasoning applies to popover-close.",
    "popover-arrow is intentionally NOT a declared part. Its size/rotation are CSS-derivable, but " +
      "its position along the popup's edge is set by Base UI at runtime via Floating UI middleware " +
      "(inline transform), never by CSS — the same runtime-only placement gap as Slider's thumb/indicator. Unlike Slider, the arrow is also a DOM child of `popover-popup`, " +
      "whose own CSS is `display:flex;flex-direction:column` for real reasons (stacking title and " +
      'description) — declaring the popup `layout: "overlay"` to host the arrow would be dishonest ' +
      "(rule 0/1 of skill-contribute-component: overlay is for a parent whose OWN children are " +
      "absolutely positioned, not an ancestor with mixed flow/runtime children), and generating the " +
      "arrow as an ordinary flow child would inflate/misplace the popup the way it would for `tabs-indicator`. Omitting it is the honest choice (a guessed position is worse than a refusal) until a declarative along-axis placement exists.",
    "popover-backdrop is a `data-slot` render-target with no co-located CSS in this component " +
      "(no modal scrim styling) — nothing to represent.",
  ],
});
