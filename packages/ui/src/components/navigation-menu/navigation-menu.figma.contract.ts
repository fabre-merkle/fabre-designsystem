import { defineFigmaContract } from "../figma-contract";

export const navigationMenuFigmaContract = defineFigmaContract({
  schemaVersion: 1,
  slug: "navigation-menu",
  componentName: "NavigationMenu",
  rootPart: "navigation-menu-root",
  parts: [
    "navigation-menu-root",
    "navigation-menu-list",
    "navigation-menu-item",
    "navigation-menu-trigger",
    "navigation-menu-trigger-label",
    "navigation-menu-icon",
    "navigation-menu-popup",
    "navigation-menu-viewport",
    "navigation-menu-content",
    "navigation-menu-link",
    "navigation-menu-link-label",
  ],
  omittedParts: {
    "navigation-menu-backdrop":
      "position: fixed; inset: 0 (navigation-menu.css) is a window-relative claim a generated " +
      "component definition has no window to make. It paints nothing, and as a flow child of the " +
      "stacked root it would only push the popup down by an empty 100px square.",
    "navigation-menu-arrow":
      "Its along-edge position is set by Base UI/Floating UI at runtime (inline transform), never " +
      "by CSS (the same runtime-only placement gap as the menu, popover and tooltip arrows), and " +
      "the docs example never renders an arrow. As a child of the popup it would land in the " +
      "content flow instead of on the popup's edge.",
  },
  axes: [
    {
      prop: "display",
      values: ["closed", "open"],
      default: "closed",
      attribute: "data-display",
      valueSelectors: { closed: null, open: "[data-popup-open]" },
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
  slots: [
    { name: "trigger-label", part: "navigation-menu-trigger-label", required: true },
    { name: "link-label", part: "navigation-menu-link-label", required: true },
    // Every icon part is a native slot — declared explicitly here
    // (never synthesized by the walker).
    { name: "caret", part: "navigation-menu-icon" },
  ],
  anatomy: {
    part: "navigation-menu-root",
    kind: "frame",
    // The browser places the popup under the trigger row, so the open variant stacks the two
    // (same shape as select/menu: popup is a flow child gated on the open state). An overlay root
    // would put the trigger list and the popup both at 0,0.
    layout: "vertical",
    children: [
      {
        part: "navigation-menu-list",
        kind: "frame",
        layout: "horizontal",
        children: [
          {
            part: "navigation-menu-item",
            kind: "frame",
            items: [
              { slots: { "trigger-label": "Products" } },
              { slots: { "trigger-label": "Solutions" } },
              {
                key: { state: "disabled" },
                slots: { "trigger-label": "Resources" },
              },
            ],
            children: [
              {
                part: "navigation-menu-trigger",
                kind: "frame",
                layout: "horizontal",
                requiredBindings: ["text"],
                children: [
                  {
                    part: "navigation-menu-trigger-label",
                    kind: "text",
                    slots: ["trigger-label"],
                    requiredBindings: ["textStyle"],
                  },
                  {
                    part: "navigation-menu-icon",
                    kind: "icon",
                    iconName: "CaretDown",
                    slots: ["caret"],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        part: "navigation-menu-popup",
        kind: "frame",
        layout: "vertical",
        requiredBindings: ["fill"],
        when: { display: "open" },
        children: [
          {
            part: "navigation-menu-viewport",
            kind: "frame",
            children: [
              {
                part: "navigation-menu-content",
                kind: "frame",
                layout: "vertical",
                children: [
                  {
                    part: "navigation-menu-link",
                    kind: "frame",
                    items: [
                      { slots: { "link-label": "Analytics" } },
                      { slots: { "link-label": "Personalization" } },
                      { slots: { "link-label": "Commerce" } },
                    ],
                    requiredBindings: ["text"],
                    children: [
                      {
                        part: "navigation-menu-link-label",
                        kind: "text",
                        slots: ["link-label"],
                        requiredBindings: ["textStyle"],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  documentation: {
    coverage: "all-axes",
    examples: [
      {
        label: "Closed",
        key: {},
        slots: { "trigger-label": "Products", "link-label": "Analytics" },
      },
      {
        label: "Open",
        key: { display: "open" },
        slots: { "trigger-label": "Products", "link-label": "Analytics" },
      },
      {
        label: "Disabled",
        key: { state: "disabled" },
        slots: { "trigger-label": "Resources", "link-label": "Documentation" },
      },
      {
        label: "Hover",
        key: { state: "hover" },
        slots: { "trigger-label": "Resources", "link-label": "Documentation" },
      },
      {
        label: "Focused",
        key: { state: "focus-visible" },
        slots: { "trigger-label": "Resources", "link-label": "Documentation" },
      },
    ],
  },
  reactToFigmaNotes: [
    "display flattens Base UI portal state into closed and open design variants.",
    "The generated definition contains trigger, popup, viewport, content, links and icon. The open variant stacks the popup under the trigger row; the backdrop and arrow are omitted (see omittedParts).",
    "A current-link axis is omitted because the source component does not expose a visually distinct current state.",
  ],
});
