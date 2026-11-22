import { defineFigmaContract } from "../figma-contract";

export const collapsibleFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "collapsible",
  componentName: "Collapsible",
  rootPart: "collapsible-root",
  parts: ["collapsible-root", "collapsible-trigger", "collapsible-panel", "collapsible-panel-text"],
  slots: [
    // collapsible.mdx renders the trigger through a render prop as a library Button (secondary):
    // a real component, so it is a composed child in a synthetic frame (the trigger itself has
    // no `data-ui` and no CSS). Button's React defaults are size md, mode filled.
    {
      name: "trigger",
      part: "collapsible-trigger",
      required: true,
      composedChild: {
        component: "button",
        variantKey: {
          variant: "secondary",
          mode: "filled",
          size: "md",
          state: "default",
          content: "label",
        },
      },
    },
    // The panel renders whatever children a consumer passes, so it is a native slot. The root
    // aligns its children to the start (`align-items: flex-start`), so the panel hugs its content
    // and the slot does not stretch. The documented example's paragraph is only its default content.
    { name: "content", part: "collapsible-panel", defaultContent: "anatomy" },
    { name: "panel-content", part: "collapsible-panel-text", required: true },
  ],
  anatomy: {
    part: "collapsible-root",
    kind: "frame",
    layout: "vertical",
    children: [
      {
        part: "collapsible-trigger",
        kind: "frame",
        layout: "horizontal",
        synthetic: true,
        slots: ["trigger"],
      },
      {
        // The slot's frame: it IS the slot, and its child is the default content.
        part: "collapsible-panel",
        kind: "frame",
        layout: "vertical",
        when: { panel: "open" },
        slots: ["content"],
        requiredBindings: ["text", "textStyle"],
        children: [
          {
            part: "collapsible-panel-text",
            kind: "text",
            synthetic: true,
            slots: ["panel-content"],
            requiredBindings: ["textStyle"],
          },
        ],
      },
    ],
  },
  axes: [
    {
      prop: "panel",
      values: ["closed", "open"],
      default: "closed",
      attribute: "data-panel",
      valueSelectors: { closed: "[data-closed]", open: "[data-open]" },
    },
  ],
  documentation: {
    coverage: "all-axes" as const,
    examples: [
      {
        label: "Open",
        key: { panel: "open" },
        slots: { "panel-content": "This content is revealed while the panel is open." },
      },
      {
        label: "Closed",
        key: {},
        slots: { "panel-content": "This content is revealed while the panel is open." },
      },
    ],
  },
  reactToFigmaNotes: [
    "panel flattens Base UI's data-open/data-closed root attributes into a design-only expanded/collapsed axis. The panel's real height (--collapsible-panel-height) is written by a runtime ResizeObserver and has no static value, so it is modelled as a state rather than a size. The panel node is gated `when: { panel: \"open\" }` so the closed variant materializes no panel at all, rather than a panel with visible-but-clipped content.",
    'The Trigger (data-slot="collapsible-trigger") is a render-prop target with no co-located styling of its own, and collapsible.mdx renders it as a library Button, so it is a Button composed child in a synthetic frame above the panel (the same shape Dialog uses for its actions). The instance shows the Button\'s own default label.',
    "`content` is the body of the panel: a panel accepts arbitrary children, so it is a native slot, " +
      "and the paragraph from the documented example is only its default content. A designer can " +
      "replace it with anything. The root aligns its children to the start, so the panel hugs its " +
      "content rather than stretching. Where a Figma build has no native slots, the same paragraph " +
      "is placed as an ordinary frame in the same position, so the panel looks identical.",
  ],
});
