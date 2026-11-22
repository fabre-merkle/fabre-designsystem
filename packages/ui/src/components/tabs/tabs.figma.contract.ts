import { defineFigmaContract } from "../figma-contract";

export const tabsFigmaContract = defineFigmaContract({
  schemaVersion: 1,
  slug: "tabs",
  componentName: "Tabs",
  rootPart: "tabs-root",
  parts: [
    "tabs-root",
    "tabs-list",
    "tabs-tab",
    "tabs-tab-label",
    "tabs-indicator",
    "tabs-tab::after",
    "tabs-panel",
    "tabs-panel-text",
  ],
  // Each tab is the `tabs-tab` Building Block, whose selected and interaction states are its own
  // variants. Its hidden sets split per variant, orientation and size ("Line Horizontal Md Tab"),
  // each holding active x state; the Tabs set holds variant x orientation x size, and each tab
  // instance shows the set for its variant and the state its item names.
  buildingBlocks: [
    {
      part: "tabs-tab",
      split: { axis: ["variant", "orientation", "size"] },
      // The focus ring is a layer shown by a boolean property, not a state: an outline changes no
      // layout, so the focused tab keeps its size.
      focusRing: {},
      axes: [
        { prop: "variant" },
        { prop: "orientation" },
        { prop: "size" },
        {
          prop: "active",
          values: ["inactive", "active"],
          default: "inactive",
          attribute: "data-active",
          valueSelectors: { inactive: null, active: "[data-active]" },
        },
        {
          prop: "state",
          values: ["default", "hover", "active", "disabled"],
          default: "default",
          attribute: "data-state",
          valueSelectors: {
            default: null,
            hover: ":hover",
            active: ":active",
            disabled: "[data-disabled]",
          },
        },
      ],
    },
  ],
  axes: [
    {
      prop: "orientation",
      values: ["horizontal", "vertical"],
      default: "horizontal",
      attribute: "data-orientation",
    },
  ],
  slots: [
    { name: "tab-label", part: "tabs-tab-label", required: true },
    // The panel renders whatever children a consumer passes, so it is a native slot that stretches
    // across the root. The documented example's text is only its default content.
    { name: "content", part: "tabs-panel", defaultContent: "anatomy", stretch: true },
    { name: "panel-content", part: "tabs-panel-text", required: true },
  ],
  runtimeValues: [
    {
      name: "active-tab-extent",
      part: "tabs-indicator",
      measures: "length" as const,
      replaces: ["--active-tab-width", "--active-tab-height"],
      reason:
        "Base UI measures the selected tab with a ResizeObserver and writes its size to --active-tab-width/--active-tab-height at runtime; tabs.css sizes the indicator's long side with them. Each example declares the percent of the selected tab the indicator spans — 100 for every example, because the indicator sits under the whole selected tab. Authored, not measured.",
    },
  ],
  anatomy: {
    part: "tabs-root",
    kind: "frame",
    layout: "vertical",
    layoutByAxis: {
      axis: "orientation",
      values: { horizontal: "vertical", vertical: "horizontal" },
    },
    children: [
      {
        part: "tabs-list",
        kind: "frame",
        layout: "horizontal",
        layoutByAxis: {
          axis: "orientation",
          values: { horizontal: "horizontal", vertical: "vertical" },
        },
        children: [
          {
            part: "tabs-tab",
            kind: "frame",
            layout: "horizontal",
            requiredBindings: ["text"],
            items: [
              {
                key: { active: "active", state: "default" },
                slots: { "tab-label": "Overview" },
              },
              {
                key: { active: "inactive", state: "default" },
                slots: { "tab-label": "Activity" },
              },
              {
                key: { active: "inactive", state: "disabled" },
                slots: { "tab-label": "Settings" },
              },
            ],
            children: [
              {
                part: "tabs-tab-label",
                kind: "text",
                slots: ["tab-label"],
                requiredBindings: ["textStyle"],
              },
              {
                part: "tabs-indicator",
                kind: "rectangle",
                requiredBindings: ["fill"],
                when: { variant: "line", active: "active" },
                // `tabs.css` positions the
                // indicator `position: absolute` with its offset/width/height
                // set by Base UI's `ResizeObserver`
                // (`--active-tab-{left,top,width,height}`) — invisible to the
                // walker, which otherwise lays it out as an ORDINARY flow
                // sibling of the tab label, inflating `tabs-tab` (measured:
                // 197px vs 78/82px for its siblings, `123:22453`).
                // `removeFromFlow` stops that.
                //
                // ORIENTATION MATTERS: `tabs-tab` is always `layout:
                // "horizontal"` (it never rotates — orientation only changes
                // which edge the CSS-drawn bar sits on), so the walker's
                // `layoutMode`-derived main axis stays HORIZONTAL in both
                // orientations. `tabs.css`'s horizontal (line) rule draws a
                // BOTTOM bar spanning the tab's full WIDTH; its vertical rule
                // draws a LEFT (inline-start) bar spanning the tab's full
                // HEIGHT — i.e. main and cross swap which one stretches.
                // `overlayCrossAlignByAxis` encodes which edge the bar sits on;
                // the declared runtime value sizes whichever physical axis the
                // CSS sizes with `--active-tab-*` in that orientation (a part
                // can only be materialized once, so this is the
                // `layoutByAxis`-shaped fix, not two anatomy nodes).
                // Resolver-confirmed per orientation
                // (`resolvedPlanFromComponentSource` against a live
                // `additionalAxes: [{ prop: "orientation", ... }]`, checked): horizontal cells resolve `height: stroke/
                // width-focused` (a real variable) with `width` refused;
                // vertical cells resolve `width: stroke/width-focused` with
                // `height` refused — the THIN dimension is a real, per-
                // orientation token either way, never invented.
                //
                // NOT reproduced: `tabs.css` offsets the bar by
                // `calc(var(--stroke-width-selected) * -1)` past the
                // stretched edge (so it sits ON the list's own border rather
                // than flush with it) — a sub-pixel nicety with no
                // `constraints`-expressible equivalent (constraints anchor to
                // an edge, they don't offset past it), so the indicator is
                // flush with the tab's edge instead. Not claimed as pixel
                // parity.
                //
                // The LONG side of the bar —
                // `--active-tab-width` (horizontal) / `--active-tab-height`
                // (vertical) — is no longer refused. The contract declares
                // its representative value per documentation example in
                // `runtimeValues` below ("active-tab-extent": the percent of
                // the selected tab the bar spans), and the engine sizes the
                // axis the CSS applies it to from that declaration. Both
                // anchors are `start`: the declared length is pinned at the
                // tab's start edge, which is exactly `--active-tab-left/top`
                // for an indicator modelled INSIDE its own tab.
                removeFromFlow: true,
                positionAlongMain: { kind: "start" },
                overlayCrossAlignByAxis: {
                  axis: "orientation",
                  values: { horizontal: "end", vertical: "start" },
                },
                reason:
                  "tabs.css positions the indicator absolutely with an offset/width/height Base UI measures at runtime (--active-tab-{left,top,width,height}) — invisible to the walker and, left undeclared, laid out as a flow sibling that inflates tabs-tab's own box). removeFromFlow takes it out of the flow; its long side is sized from the declared runtime value active-tab-extent, pinned at the tab's start edge (positionAlongMain start), and its thin side sits on the bottom edge (horizontal) or the inline-start edge (vertical) via overlayCrossAlignByAxis. The -stroke-width-selected offset past the edge (so the bar sits ON the list's border) is NOT reproduced — no constraints-expressible equivalent; the indicator is flush with the edge instead, not pixel-identical.",
              },
              {
                // The hover bar: the tab's `::after`, painted on a hovered, unselected, enabled
                // Line tab only.
                part: "tabs-tab::after",
                kind: "rectangle",
                requiredBindings: ["fill"],
                when: { variant: "line", active: "inactive", state: "hover" },
                removeFromFlow: true,
                positionAlongMainByAxis: {
                  axis: "orientation",
                  values: { horizontal: { kind: "stretch" }, vertical: { kind: "start" } },
                },
                overlayCrossAlignByAxis: {
                  axis: "orientation",
                  values: { horizontal: "end", vertical: "stretch" },
                },
                reason:
                  "tabs.css draws the hover bar as the tab's ::after, positioned absolutely along the same edge as the indicator. Horizontal: `inset-inline: 0` spans the tab's width (its main axis, stretch) and the bar sits on the bottom edge (cross end). Vertical: it sits on the inline-start edge (main start) and `top: 0; height: 100%` spans the tab's height (cross stretch). Its thickness is the focused stroke width and its colour the hover token, both bound. The -stroke-width-selected offset past the edge is not reproduced, as for the indicator; the bar is flush with the edge.",
              },
            ],
          },
        ],
      },
      {
        // The slot's frame: it IS the slot, and its child is the default content.
        part: "tabs-panel",
        kind: "frame",
        layout: "vertical",
        slots: ["content"],
        requiredBindings: ["text", "textStyle"],
        children: [
          {
            part: "tabs-panel-text",
            kind: "text",
            synthetic: true,
            slots: ["panel-content"],
            requiredBindings: ["textStyle"],
          },
        ],
      },
    ],
  },
  documentation: {
    coverage: "all-axes",
    examples: [
      {
        label: "Line",
        key: {},
        slots: { "tab-label": "Overview", "panel-content": "Overview content" },
        runtimeValues: { "active-tab-extent": "100" },
      },
      {
        label: "Segment small",
        key: { size: "sm", variant: "segment" },
        slots: { "tab-label": "Activity", "panel-content": "Activity content" },
      },
      {
        label: "Segment extra small",
        key: { size: "xs", variant: "segment" },
        slots: { "tab-label": "Week", "panel-content": "Week content" },
      },
      {
        label: "Vertical large",
        key: { size: "lg", orientation: "vertical" },
        slots: { "tab-label": "Settings", "panel-content": "Settings content" },
      },
    ],
  },
  reactToFigmaNotes: [
    "Each tab is a Building Block with its own hidden sets, one for each variant, orientation and " +
      "size. Its active and state axes model the selected tab and the hover, press and disabled " +
      "states that Base UI applies at runtime; each tab in a Tabs variant shows the state its item " +
      "names (the first tab selected, the second idle, the third disabled), so the Tabs set itself " +
      "varies only by variant, orientation and size.",
    "A tab's keyboard focus is a ring layer, shown by the tab's focus-visible property, not a " +
      "state: the browser draws it as an outline, which never changes the tab's size. The ring sits " +
      "just inside a Line tab and on the edge of a Segment tab, as the stylesheet's outline offsets " +
      "place it.",
    "orientation is promoted to the component definition so horizontal and vertical layouts remain reviewable.",
    "The panel's focus ring is not generated: focus is shown on the tabs.",
    "A hovered Line tab shows its hover bar, drawn by the tab's ::after: a layer outside the " +
      "tab's flow that spans the tab along the same edge as the selected tab's indicator. It is " +
      "only in unselected, enabled, hovered Line tabs, as the stylesheet paints it.",
    "`content` is the body of the tab panel: a panel accepts arbitrary children, so it is a native " +
      "slot that stretches across the tabs root (across its width when the tabs are horizontal, its " +
      "height when they are vertical), and the text from the documented example is only its default " +
      "content. A designer can replace it with anything. Where a Figma build has no native slots, the " +
      "same text is placed as an ordinary frame in the same position, so the panel looks identical.",
  ],
});
