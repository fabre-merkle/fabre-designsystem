import { defineFigmaContract } from "../figma-contract";

export const separatorFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "separator",
  componentName: "Separator",
  rootPart: "separator",
  parts: ["separator", "separator::before", "separator::after", "separator-label"],
  axes: [],
  slots: [{ name: "label", part: "separator-label" }],
  anatomy: {
    part: "separator",
    kind: "frame" as const,
    layout: "horizontal" as const,
    children: [
      {
        // `[data-ui="separator"][data-variant="solid-text"]::before` and
        // `[data-ui="separator"][data-variant="content"]::before` are the SAME
        // DOM pseudo-element (one `::before` per host), so they resolve as
        // ONE part — but the two variants use it in genuinely
        // different STRUCTURAL roles: solid-text's bar is absolutely
        // positioned full-width behind the centered label
        // (`position: absolute; inset-inline: 0`), while content's bar is a
        // real in-flow `flex: 1` sibling beside the label. `when` selects
        // which variants materialize it at all (an array value is an OR
        // across that one axis); `removeFromFlowByAxis`/
        // `overlayCrossAlignByAxis` select WHICH of those two structural
        // roles applies per variant, since a part is materialized exactly
        // once and can't be declared twice.
        part: "separator::before",
        kind: "rectangle" as const,
        when: { variant: ["solid-text", "content"] },
        removeFromFlowByAxis: { axis: "variant", values: { "solid-text": true } },
        overlayCrossAlignByAxis: { axis: "variant", values: { "solid-text": "center" as const } },
        positionAlongMain: { kind: "stretch" as const },
        requiredBindings: ["fill" as const],
        reason:
          "solid-text's ::before is CSS `position: absolute; inset-inline: 0; top: 50%` — a " +
          "full-width bar behind the centered label, invisible to normal auto-layout flow. " +
          "removeFromFlow + positionAlongMain: stretch reproduce the full-width span at " +
          "generation time (same mechanism as tabs-indicator); overlayCrossAlign: " +
          "center approximates `top: 50%` — CSS declares no transform to true-center the bar on " +
          "that line, so this is the closest honest primitive Figma constraints offer, not pixel- " +
          "identical (same admitted imprecision as tabs-indicator's own edge offset). content's " +
          "::before needs NONE of this: it's an ordinary `flex: 1` auto-layout child, so " +
          'removeFromFlowByAxis leaves it in-flow (no entry for "content" falls back to ' +
          "`removeFromFlow: undefined`) and overlayCrossAlignByAxis leaves it unset too, so " +
          "neither positioning path fires for it. Only WIDTH stays refused for solid-text — see " +
          "figma-layout.config.ts FIGMA_LAYOUT_EXCLUDES.",
      },
      {
        part: "separator-label",
        kind: "text" as const,
        synthetic: true,
        unless: { variant: "line" },
        slots: ["label"],
        requiredBindings: ["textStyle" as const],
      },
      {
        // Only `content` has an ::after — solid-text/underline/line don't,
        // so a plain single-value `when` (no array) is enough here.
        part: "separator::after",
        kind: "rectangle" as const,
        when: { variant: "content" },
        requiredBindings: ["fill" as const],
      },
    ],
  },
  literalGeometry: [
    // The vertical `line` is `align-self: stretch` with only a width: it spans its flex parent's
    // height. As its own component-set root there is no parent to stretch in, so it takes the
    // same documentation-preview length the horizontal line takes as its width (320px, see
    // `figma-layout.config.ts`), instead of being left without a height.
    { part: "separator", when: { variant: "line", orientation: "vertical" }, height: 320 },
    { part: "separator", when: { variant: "solid-text", size: "md" }, fontSize: 20 },
    { part: "separator", when: { variant: "underline", size: "md" }, fontSize: 20 },
    { part: "separator", when: { variant: "content", size: "md" }, fontSize: 20 },
    { part: "separator", when: { variant: "solid-text", size: "lg" }, fontSize: 24 },
    { part: "separator", when: { variant: "underline", size: "lg" }, fontSize: 24 },
    { part: "separator", when: { variant: "content", size: "lg" }, fontSize: 24 },
  ],
  documentation: {
    coverage: "all-axes" as const,
    examples: [
      { label: "Horizontal line", key: { size: "sm" } },
      {
        label: "Solid text medium",
        key: { variant: "solid-text" },
        slots: { label: "OR" },
      },
      {
        label: "Underlined label",
        key: { variant: "underline", size: "lg" },
        slots: { label: "OR" },
      },
      {
        label: "Vertical content",
        key: { variant: "content", orientation: "vertical" },
        slots: { label: "OR" },
      },
    ],
  },
});
