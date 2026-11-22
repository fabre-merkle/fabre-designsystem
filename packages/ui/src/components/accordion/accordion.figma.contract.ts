import { defineFigmaContract } from "../figma-contract";

export const accordionFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "accordion",
  componentName: "Accordion",
  rootPart: "accordion-root",
  parts: [
    "accordion-root",
    "accordion-item",
    "accordion-header",
    "accordion-trigger",
    "accordion-trigger-label",
    "accordion-trigger-icon",
    "accordion-panel",
    "accordion-panel-text",
  ],
  slots: [
    { name: "trigger-label", part: "accordion-trigger-label", required: true },
    // The panel renders whatever children a consumer passes, so it is a native slot that stretches
    // across the item. The documented example's paragraph is only its default content.
    { name: "content", part: "accordion-panel", defaultContent: "anatomy", stretch: true },
    { name: "panel-content", part: "accordion-panel-text", required: true },
    // Every icon part is a native slot — declared explicitly here
    // (never synthesized by the walker).
    { name: "caret", part: "accordion-trigger-icon" },
  ],
  anatomy: {
    part: "accordion-root",
    kind: "frame",
    layout: "vertical",
    children: [
      {
        part: "accordion-item",
        kind: "frame",
        layout: "vertical",
        items: [
          {
            key: { panel: "open", state: "default" },
            slots: {
              "trigger-label": "Shipping",
              "panel-content": "Ships within 2 business days via standard courier.",
            },
          },
          {
            key: { panel: "closed", state: "default" },
            slots: {
              "trigger-label": "Returns",
              "panel-content": "Returns are accepted within 30 days of delivery.",
            },
          },
          {
            key: { panel: "closed", state: "disabled" },
            slots: {
              "trigger-label": "Warranty",
              "panel-content": "Warranty terms vary by product category.",
            },
          },
        ],
        children: [
          {
            part: "accordion-header",
            kind: "frame",
            layout: "horizontal",
            children: [
              {
                part: "accordion-trigger",
                kind: "frame",
                layout: "horizontal",
                requiredBindings: ["text"],
                children: [
                  {
                    part: "accordion-trigger-label",
                    kind: "text",
                    slots: ["trigger-label"],
                    requiredBindings: ["textStyle"],
                  },
                  {
                    part: "accordion-trigger-icon",
                    kind: "icon",
                    iconName: "CaretDown",
                    slots: ["caret"],
                  },
                ],
              },
            ],
          },
          {
            // The slot's frame: it IS the slot, and its child is the default content.
            part: "accordion-panel",
            kind: "frame",
            layout: "vertical",
            when: { panel: "open" },
            slots: ["content"],
            requiredBindings: ["text", "textStyle"],
            children: [
              {
                part: "accordion-panel-text",
                kind: "text",
                synthetic: true,
                slots: ["panel-content"],
                requiredBindings: ["textStyle"],
              },
            ],
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
      valueSelectors: { closed: null, open: "[data-panel-open]" },
      // The item carries Base UI's own `data-open`; the trigger and the panel carry `data-panel-open`.
      partValueSelectors: { "accordion-item": { closed: null, open: "[data-open]" } },
    },
    {
      prop: "state",
      values: ["default", "hover", "focus-visible", "disabled"],
      default: "default",
      attribute: "data-state",
      valueSelectors: {
        default: null,
        hover: ":hover",
        "focus-visible": ":focus-visible",
        disabled: "[data-disabled]",
      },
    },
  ],
  documentation: {
    coverage: "all-axes" as const,
    examples: [
      {
        label: "Open item",
        key: { panel: "open" },
        slots: {
          "trigger-label": "Shipping",
          "panel-content": "Ships within 2 business days via standard courier.",
        },
      },
      {
        label: "Closed item",
        key: {},
        slots: {
          "trigger-label": "Returns",
          "panel-content": "Returns are accepted within 30 days of delivery.",
        },
      },
      {
        label: "Keyboard-focused trigger",
        key: { state: "focus-visible" },
        slots: {
          "trigger-label": "Returns",
          "panel-content": "Returns are accepted within 30 days of delivery.",
        },
      },
      {
        label: "Disabled item",
        key: { state: "disabled" },
        slots: {
          "trigger-label": "Warranty",
          "panel-content": "Warranty terms vary by product category.",
        },
      },
      {
        label: "Hover",
        key: { state: "hover" },
        slots: {
          "trigger-label": "Warranty",
          "panel-content": "Warranty terms vary by product category.",
        },
      },
    ],
  },
  reactToFigmaNotes: [
    "panel flattens Base UI's data-panel-open trigger attribute into a design-only expanded/collapsed axis; the panel's real height (--accordion-panel-height) is written by a runtime ResizeObserver and has no static value, so it is modelled as a state rather than a size. The panel node is gated `when: { panel: \"open\" }` so a closed item materializes no panel at all, rather than a panel with visible-but-clipped content.",
    "The open-item background lift reads Base UI's own `data-open` on the item (`[data-ui=\"accordion-item\"][data-open]`). The `panel` axis maps open to `[data-panel-open]`, which the trigger and the panel carry; `partValueSelectors` gives the item part its own `[data-open]`, so the item's fill binds in the open cells.",
    'accordion-trigger-icon rotates 180deg on open ([data-panel-open] [data-ui="accordion-trigger-icon"] { rotate: 180deg }) — neither the resolved plan nor the plugin walker has a rotation field (there is no rotation field anywhere in the pipeline). Faking it with a second static icon asset would misrepresent a CSS transform as a different icon, so the icon is emitted identically (unrotated) in every documented example instead.',
    "`content` is the body of each panel: a panel accepts arbitrary children, so it is a native slot " +
      "that stretches across the item, and the paragraph from the documented example is only its " +
      "default content. A designer can replace it with anything. Where a Figma build has no native " +
      "slots, the same paragraph is placed as an ordinary frame in the same position, so the panel " +
      "looks identical. The slot sits on the panel, so every item instance carries its own.",
  ],
});
