import { defineFigmaContract } from "../figma-contract";

export const contextMenuFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "context-menu",
  componentName: "ContextMenu",
  // ContextMenu has no visible trigger button at all — its docs example (`context-menu.mdx`)
  // right-clicks an arbitrary area styled entirely with inline styles, not a library component and
  // not co-located CSS. `context-menu-trigger` (`context-menu.tsx`) is `data-slot`, never `data-ui`
  // — there is no CSS to derive a Figma part from and no library component to compose (unlike Menu's
  // Button), so a trigger anatomy node would either invent a box or a relationship the component
  // doesn't have. It is left undocumented here (see reactToFigmaNotes), the same treatment
  // popover.figma.contract.ts gives popover-trigger — NOT `omittedParts`, since that field validates
  // its key as a real, CSS-resolvable `data-ui` source part (compiler.ts), which `data-slot`-only
  // context-menu-trigger is not. The root is context-menu-popup itself, the single design-facing
  // artifact — a right-click surface has no closed state worth documenting, so there is no popup
  // axis either (contrast Menu, whose Button trigger IS a design-facing closed state).
  rootPart: "context-menu-popup",
  parts: [
    "context-menu-popup",
    "context-menu-group",
    "context-menu-group-label",
    "context-menu-item",
    "context-menu-item-label",
    "context-menu-submenu-icon",
    "context-menu-separator",
    "context-menu-checkbox-item",
    "context-menu-checkbox-item-indicator",
    "context-menu-checkbox-item-label",
    "context-menu-radio-group",
    "context-menu-radio-item",
    "context-menu-radio-item-indicator",
    "context-menu-radio-item-indicator::before",
    "context-menu-radio-item-label",
  ],
  // Every icon part is a native slot — declared explicitly (never synthesized by the
  // walker), matching checkbox's `check-icon`/`minus-icon` pattern.
  slots: [
    { name: "group-label", part: "context-menu-group-label", required: true },
    { name: "item-text", part: "context-menu-item-label", required: true },
    { name: "submenu-icon", part: "context-menu-submenu-icon" },
    { name: "check-icon", part: "context-menu-checkbox-item-indicator" },
    { name: "checkbox-item-text", part: "context-menu-checkbox-item-label", required: true },
    { name: "radio-item-text", part: "context-menu-radio-item-label", required: true },
  ],
  anatomy: {
    part: "context-menu-popup",
    kind: "frame",
    layout: "vertical",
    requiredBindings: ["fill"],
    children: [
      {
        part: "context-menu-group",
        kind: "frame",
        layout: "vertical",
        children: [
          {
            part: "context-menu-group-label",
            kind: "text",
            slots: ["group-label"],
            requiredBindings: ["textStyle"],
          },
          {
            part: "context-menu-item",
            kind: "frame",
            layout: "horizontal",
            requiredBindings: ["text"],
            children: [
              {
                part: "context-menu-item-label",
                kind: "text",
                synthetic: true,
                slots: ["item-text"],
                requiredBindings: ["textStyle"],
              },
              {
                part: "context-menu-submenu-icon",
                kind: "icon",
                iconName: "CaretRight",
                when: { submenu: "trigger" },
                slots: ["submenu-icon"],
              },
            ],
          },
        ],
      },
      { part: "context-menu-separator", kind: "rectangle" },
      {
        part: "context-menu-checkbox-item",
        kind: "frame",
        layout: "horizontal",
        requiredBindings: ["text"],
        children: [
          {
            part: "context-menu-checkbox-item-indicator",
            kind: "icon",
            iconName: "Check",
            when: { checked: "checked" },
            slots: ["check-icon"],
          },
          {
            part: "context-menu-checkbox-item-label",
            kind: "text",
            synthetic: true,
            slots: ["checkbox-item-text"],
            requiredBindings: ["textStyle"],
          },
        ],
      },
      {
        part: "context-menu-radio-group",
        kind: "frame",
        layout: "vertical",
        children: [
          {
            part: "context-menu-radio-item",
            kind: "frame",
            layout: "horizontal",
            requiredBindings: ["text"],
            children: [
              {
                part: "context-menu-radio-item-indicator",
                kind: "frame",
                when: { checked: "checked" },
                children: [
                  {
                    part: "context-menu-radio-item-indicator::before",
                    kind: "rectangle",
                    requiredBindings: ["fill"],
                  },
                ],
              },
              {
                part: "context-menu-radio-item-label",
                kind: "text",
                synthetic: true,
                slots: ["radio-item-text"],
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
      prop: "highlighted",
      values: ["idle", "highlighted"],
      default: "idle",
      attribute: "data-highlighted",
      valueSelectors: { idle: null, highlighted: "[data-highlighted]" },
    },
    {
      prop: "checked",
      values: ["unchecked", "checked"],
      default: "unchecked",
      attribute: "data-checked",
      valueSelectors: { unchecked: null, checked: "[data-checked]" },
    },
    {
      prop: "submenu",
      values: ["none", "trigger"],
      default: "none",
      attribute: "data-submenu-trigger",
      valueSelectors: { none: null, trigger: "[data-submenu-trigger]" },
    },
    {
      prop: "state",
      values: ["default", "disabled"],
      default: "default",
      attribute: "data-state",
      valueSelectors: {
        default: null,
        disabled: "[data-disabled]",
      },
    },
  ],
  literalGeometry: [{ part: "context-menu-checkbox-item-indicator", width: 16, height: 16 }],
  omittedParts: {
    "context-menu-backdrop":
      "position: fixed; inset: 0 (context-menu.css) is a window-relative claim a generated " +
      "component definition has no window to make — omitted, not rendered, " +
      "not stretched over the frame as a stand-in.",
    "context-menu-arrow":
      "Its along-edge position is set by Base UI/Floating UI at runtime (inline transform), never " +
      "by CSS — the same runtime-only placement gap as Slider and the popover/tooltip/" +
      "preview-card arrows (FIGMA_ANCHORED_POPUP_COMPONENTS). ContextMenu's own docs example never " +
      "renders an Arrow child either. Generating it would misplace it at the popup's origin.",
  },
  documentation: {
    coverage: "all-axes" as const,
    examples: [
      {
        label: "Default",
        key: {},
        slots: {
          "group-label": "Actions",
          "item-text": "Copy",
          "checkbox-item-text": "Show hidden files",
          "radio-item-text": "Ascending",
        },
      },
      {
        label: "Highlighted item",
        key: { highlighted: "highlighted", checked: "checked" },
        slots: {
          "group-label": "Actions",
          "item-text": "Paste",
          "checkbox-item-text": "Show hidden files",
          "radio-item-text": "Ascending",
        },
      },
      {
        label: "Submenu trigger",
        key: { submenu: "trigger" },
        slots: {
          "group-label": "Actions",
          "item-text": "Share",
          "checkbox-item-text": "Show hidden files",
          "radio-item-text": "Ascending",
        },
      },
      {
        label: "Disabled item",
        key: { state: "disabled" },
        slots: {
          "group-label": "Actions",
          "item-text": "Delete",
          "checkbox-item-text": "Show hidden files",
          "radio-item-text": "Ascending",
        },
      },
    ],
  },
  reactToFigmaNotes: [
    "ContextMenu has no design-facing closed state: its trigger is an arbitrary right-click surface " +
      "(no CSS, no composed library component — see below), not a design-facing artifact, so the popup " +
      "IS the component root, always shown. Highlighted, state, checked, and submenu flatten " +
      "Base UI runtime states/markers into design variants — none of them change context-menu-popup's " +
      "own paint, the same reasoning select.figma.contract.ts documents for its own axes.",
    "context-menu-trigger (data-slot, never data-ui) is intentionally NOT a declared part, and not in " +
      "omittedParts either — that field validates its key as a real, CSS-resolvable data-ui source " +
      "part (compiler.ts), which context-menu-trigger, having no CSS at all, is not. Its docs example " +
      "is an arbitrary inline-styled div, not a contracted library component (unlike Menu, which " +
      "composes a Button), so there is nothing honest to model — the same treatment " +
      "popover.figma.contract.ts gives popover-trigger.",
    "context-menu-checkbox-item-indicator is declared as icon-kind anatomy (Check, a real SVG the " +
      "component already renders as CheckboxItemIndicator's default child) and covered by the " +
      "declared `check-icon` slot (every icon part must be a native slot).",
    "context-menu-radio-item-indicator's visible dot is `::before` (`width: 8px; height: 8px; " +
      "border-radius: 50%; background-color: currentcolor`) — a pseudo-element, not a DOM node, " +
      "resolved as a real CSS-derived anatomy part: " +
      "`context-menu-radio-item-indicator::before` is a rectangle child of the indicator frame, " +
      "resolving to an 8x8 box with radiusPx 4 (exact arithmetic on the literal square, the `matchRoot` precedent) and a fill bound through the indicator's own `color` (currentcolor " +
      "resolves through the HOST part's binding, never defaulted).",
    "context-menu-submenu-icon is declared as icon-kind anatomy (CaretRight, a real Phosphor SVG that " +
      'SubmenuTrigger renders as a trailing child) gated `when: { submenu: "trigger" }` ' +
      "and covered by the declared `submenu-icon` slot. It replaced a `::after` caret drawn with " +
      "`rotate: 45deg` borders, which the resolver refuses; the icon is a real part so " +
      "browser and Figma match. Under RTL the icon is mirrored in CSS (`scale: -1 1`).",
    "context-menu-item-label / context-menu-checkbox-item-label / context-menu-radio-item-label are " +
      "synthetic text children: Item/CheckboxItem/RadioItem render their label directly as text " +
      "content with no wrapping data-ui element, unlike Select's separate select-item-text. Each " +
      "inherits its textStyle from its real parent part's own CSS (context-menu-item/-checkbox-item/" +
      "-radio-item all set font-family/size/weight/line-height/color directly on themselves).",
  ],
});
