import { defineFigmaContract } from "../figma-contract";

export const sliderFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "slider",
  componentName: "Slider",
  rootPart: "slider",
  parts: [
    "slider",
    "slider-value",
    "slider-control",
    "slider-track",
    "slider-indicator",
    "slider-thumb",
  ],
  slots: [{ name: "value", part: "slider-value" }],
  // One set per orientation ("Horizontal Slider", "Vertical Slider"), each holding
  // size x validity x state.
  split: { axis: "orientation" },
  anatomy: {
    part: "slider",
    kind: "frame",
    // `slider.css` is `display: flex` with the DEFAULT `flex-direction: row` — the
    // value sits BESIDE the control — and only `[data-orientation="vertical"]`
    // switches to column. The authored `layout` wins over the CSS-derived
    // direction, so declaring a bare "vertical" here applied column to all 96
    // cells, including every horizontal one. Keyed off the orientation axis
    // instead, exactly as `tabs` does for the same reason.
    layout: "horizontal",
    layoutByAxis: {
      axis: "orientation",
      values: { horizontal: "horizontal", vertical: "vertical" },
    },
    children: [
      { part: "slider-value", kind: "text", slots: ["value"], requiredBindings: ["text"] },
      {
        part: "slider-control",
        kind: "frame",
        // NOT an overlay: `[data-ui="slider-control"]` is `display: flex;
        // align-items: center` — an ordinary flex row holding the track. It was
        // declared "overlay", which forced `layoutMode: "NONE"`, which left
        // `slider-track`'s `flex: 1 1 auto` (→ Figma FILL) with no auto-layout
        // parent to fill — the "outside an auto-layout parent" refusal. Only the
        // TRACK is a genuine overlay, because only its children (indicator and
        // thumb) are absolutely positioned.
        layout: "horizontal",
        layoutByAxis: {
          axis: "orientation",
          values: { horizontal: "horizontal", vertical: "vertical" },
        },
        children: [
          {
            part: "slider-track",
            kind: "frame",
            layout: "overlay",
            requiredBindings: ["fill"],
            children: [
              {
                part: "slider-indicator",
                kind: "rectangle",
                requiredBindings: ["fill"],
                // The filled part of the rail, so it is as THICK as the rail.
                // `indicator.css` says `border-radius: inherit` and nothing about
                // size — Base UI sets its length from the value at runtime, which
                // is why only the cross axis is a static anchor.
                overlayCrossAlign: "stretch",
                // The LENGTH is value-driven — spans `0 →
                // value%` of the track, reading the SAME documented slot
                // (`slots: [{ name: "value", part: "slider-value" }]`) every
                // example already carries. Always pinned at the track's
                // origin (there is no other honest anchor for a value-driven
                // length).
                sizeAlongMain: { kind: "valueOf", slot: "value" },
                reason:
                  "The indicator's length has no CSS to derive from — Base UI sets it from the live value via inline style — but the value is already an authored, documented slot, so the length is arithmetic on that value rather than a guess.",
              },
              {
                part: "slider-thumb",
                kind: "ellipse",
                requiredBindings: ["fill"],
                // Base UI centres the thumb on the track at runtime with inline
                // styles, so the stylesheet never says so — and the
                // `align-items: center` that IS in the CSS belongs to
                // `slider-control` and centres the TRACK. Without this the thumb
                // lands at the track's origin and a 24px circle hangs off a 6px
                // rail.
                overlayCrossAlign: "center",
                // Position ALONG the track — centres the
                // thumb AT `value%`, reading the same documented slot the
                // indicator's length reads.
                positionAlongMain: { kind: "valueOf", slot: "value" },
                reason:
                  "The thumb's offset along the track has no CSS to derive from — Base UI centres it from the live value via inline style at runtime — but the value is already an authored, documented slot, so the offset is arithmetic on that value rather than a guess.",
              },
            ],
          },
        ],
      },
    ],
  },
  axes: [
    {
      prop: "orientation",
      values: ["horizontal", "vertical"],
      default: "horizontal",
      attribute: "data-orientation",
      valueSelectors: { horizontal: null, vertical: '[data-orientation="vertical"]' },
    },
    {
      prop: "validity",
      values: ["valid", "invalid"],
      default: "valid",
      attribute: "data-validity",
      valueSelectors: { valid: null, invalid: "[data-invalid]" },
    },
    {
      prop: "state",
      values: ["default", "hover", "active", "focus-visible", "disabled"],
      default: "default",
      attribute: "data-state",
      valueSelectors: {
        default: null,
        hover: ":hover",
        active: "[data-dragging]",
        "focus-visible": ":focus-visible",
        disabled: "[data-disabled]",
      },
    },
  ],
  documentation: {
    coverage: "all-axes" as const,
    examples: [
      {
        label: "Horizontal small",
        key: { size: "sm" },
        slots: { value: "25" },
      },
      {
        label: "Vertical medium focused",
        key: { orientation: "vertical", state: "focus-visible" },
        slots: { value: "50" },
      },
      {
        label: "Large dragging",
        key: { size: "lg", state: "active" },
        slots: { value: "75" },
      },
      {
        label: "Invalid disabled",
        key: { validity: "invalid", state: "disabled" },
        slots: { value: "0" },
      },
      {
        label: "Hover",
        key: { state: "hover" },
        slots: { value: "0" },
      },
    ],
  },
  reactToFigmaNotes: [
    "Orientation, validity, and state (hover, active, focus-visible, disabled) flatten Base UI runtime states into design variants.",
  ],
});
