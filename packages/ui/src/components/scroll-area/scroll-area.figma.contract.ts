import { defineFigmaContract } from "../figma-contract";

export const scrollAreaFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "scroll-area",
  componentName: "ScrollArea",
  rootPart: "scroll-area-root",
  parts: [
    "scroll-area-root",
    "scroll-area-viewport",
    "scroll-area-content",
    "scroll-area-scrollbar",
    "scroll-area-thumb",
    "scroll-area-corner",
  ],
  slots: [{ name: "content", part: "scroll-area-content", required: true }],
  // The docs example constrains the root with an inline `height: 220, width: 100%`; the root is an
  // overlay (no hug, no flow), so without a declared size it keeps Figma's 100x100 default. 320 is
  // the same documentation-preview width the other `width: 100%` roots use. The viewport is
  // `width/height: 100%` of the root, which is illegal as FILL inside an overlay; the layout
  // manifest (`figma-layout.config.ts`) gives it the same box.
  literalGeometry: [{ part: "scroll-area-root", width: 320, height: 220 }],
  runtimeValues: [
    {
      name: "thumb-length",
      part: "scroll-area-thumb",
      measures: "length" as const,
      replaces: [],
      reason:
        "Base UI sizes the thumb from the ratio of the visible viewport to the scrollable content, as an inline style at runtime. Each example declares that ratio as a percent of the track. Authored, not measured.",
    },
    {
      name: "scroll-position",
      part: "scroll-area-thumb",
      measures: "travel" as const,
      replaces: [],
      reason:
        "Base UI offsets the thumb from the live scroll position, as an inline style at runtime. Each example declares how far the content is scrolled: 0 puts the thumb at the start of the track, 100 at the end. Authored, not measured.",
    },
  ],
  anatomy: {
    part: "scroll-area-root",
    kind: "frame",
    layout: "overlay",
    children: [
      {
        part: "scroll-area-viewport",
        kind: "frame",
        layout: "vertical",
        children: [
          {
            part: "scroll-area-content",
            kind: "text",
            slots: ["content"],
          },
        ],
      },
      {
        part: "scroll-area-scrollbar",
        kind: "frame",
        layout: "vertical",
        layoutByAxis: {
          axis: "orientation",
          values: { vertical: "vertical", horizontal: "horizontal" },
        },
        overlayCrossAlign: "end",
        // `height: 100%` (vertical) / `width: 100%` (horizontal) in
        // scroll-area.css: the track spans the root along its length. The
        // root is an overlay, so FILL is not available; a static stretch
        // anchor is the same 100%.
        positionAlongMain: { kind: "stretch" },
        reason:
          "scroll-area.css gives the scrollbar track 100% of the root along its length; the root is an overlay (Base UI positions the scrollbar with runtime inline styles), so the track is stretched along the root's main axis instead of filling it. The thumb's declared length and position are percents of this track.",
        children: [
          {
            part: "scroll-area-thumb",
            kind: "rectangle",
            requiredBindings: ["fill"],
            // The thumb's length and offset are
            // Base UI inline styles computed from live scroll metrics. They
            // are no longer refused: each documentation example declares a
            // representative thumb length and scroll position
            // (`runtimeValues` above), and the engine places the thumb from
            // them. `removeFromFlow` because the thumb is offset inside its
            // track (`scroll-area-scrollbar`, an auto-layout flow container),
            // which a flow cannot express.
            removeFromFlow: true,
            sizeAlongMain: { kind: "valueOf", runtimeValue: "thumb-length" },
            positionAlongMain: { kind: "valueOf", runtimeValue: "scroll-position" },
            overlayCrossAlign: "stretch",
            reason:
              "Base UI sets the thumb's length and offset as inline styles from live scroll metrics, so neither has a static CSS value. The thumb is taken out of the track's flow and placed from the declared runtime values thumb-length (percent of the track) and scroll-position (0 = start of the track, 100 = end), and spans the track's thickness. The track's 2px padding is not reproduced on the thumb's thin side — an absolutely positioned Figma child ignores its parent's padding. Authored, not measured.",
          },
        ],
      },
      {
        part: "scroll-area-corner",
        kind: "rectangle",
      },
    ],
  },
  axes: [
    {
      prop: "orientation",
      values: ["vertical", "horizontal"],
      default: "vertical",
      attribute: "data-orientation",
      valueSelectors: {
        vertical: '[data-orientation="vertical"]',
        horizontal: '[data-orientation="horizontal"]',
      },
    },
    {
      // Only the thumb has a state to design: its colour on hover. The track's own hover and scroll
      // visibility is an opacity literal, which is not modelled (see the notes).
      prop: "state",
      values: ["default", "hover"],
      default: "default",
      attribute: "data-state",
      valueSelectors: { default: null, hover: ":hover" },
    },
  ],
  documentation: {
    coverage: "all-axes" as const,
    examples: [
      {
        label: "Vertical",
        key: {},
        slots: { content: "Row 1 · Row 2 · Row 3 · Row 4 · Row 5" },
        // Content about two and a half viewports tall, scrolled halfway.
        runtimeValues: { "thumb-length": "40", "scroll-position": "50" },
      },
      {
        label: "Horizontal",
        key: { orientation: "horizontal" },
        slots: { content: "Row 1 · Row 2 · Row 3 · Row 4 · Row 5" },
        // Same content ratio, not scrolled yet.
        runtimeValues: { "thumb-length": "40", "scroll-position": "0" },
      },
      {
        label: "Thumb hover",
        key: { state: "hover" },
        slots: { content: "Row 1 · Row 2 · Row 3 · Row 4 · Row 5" },
        runtimeValues: { "thumb-length": "40", "scroll-position": "50" },
      },
    ],
  },
  reactToFigmaNotes: [
    "orientation flattens the Scrollbar/Thumb `orientation` prop (always present as data-orientation) into a design axis; the resolver has no `:has()`/descendant support, so it is expressed directly on scroll-area-scrollbar rather than inferred.",
    "state is the standard design-only axis. `hover` is the thumb's `:hover` colour; it has no prop to set.",
    "The hover/scroll-driven visibility toggle (opacity: 0 idle, opacity: 1 on [data-hovering]/[data-scrolling]) is intentionally NOT modelled as a design axis: both values are raw CSS literals with no var() reference, and the resolver only binds a property whose value names a Figma variable (the resolver's `varRefs(value)` early-returns on a literal, with no exception for opacity). Neither the resolved plan nor the plugin walker has any other route to a literal opacity value (only var()-bound `geometry.opacity` bindings exist). Modelling idle/visible as two axis values would generate two structurally identical variants (the resolver drops the literal on both), which is worse than not claiming the distinction at all — scroll-area-scrollbar and scroll-area-thumb are generated as one representative state, with the CSS's own opacity toggle left undocumented rather than faked.",
    "scroll-area-scrollbar and scroll-area-thumb are positioned with runtime inline styles (Base UI computes top/bottom/inset-inline-* and the thumb's drag offset from live scroll metrics) — the anatomy declares scroll-area-root as an overlay, docks the scrollbar to the cross-axis end and stretches it along the root, and places the thumb from the length and scroll position each documentation example declares (runtimeValues).",
  ],
});
