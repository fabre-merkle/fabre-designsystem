import { defineFigmaContract } from "../figma-contract";

export const menuFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "menu",
  componentName: "Menu",
  // `menu-trigger` (`menu.tsx`) is `data-slot="menu-trigger"`, never `data-ui` — Menu never styles
  // its own trigger, which is an arbitrary consumer element (typically a Button, per menu.mdx's own
  // showcase). Unlike Select (whose trigger it otherwise mirrors), there is no
  // CSS to derive a Figma part from. The composed-child slot is what makes modelling it
  // honest anyway: the trigger's REAL geometry comes from Button's own generated component, not an
  // invented box. `menu-trigger` is therefore declared `synthetic` (contract-only, no `data-ui`
  // source) and the root purely to hold that slot + the trigger-anchored popup below it.
  rootPart: "menu-trigger",
  parts: [
    "menu-trigger",
    "menu-popup",
    "menu-group",
    "menu-group-label",
    "menu-item",
    "menu-item-label",
    "menu-submenu-icon",
    "menu-separator",
    "menu-checkbox-item",
    "menu-checkbox-item-indicator",
    "menu-checkbox-item-label",
    "menu-radio-group",
    "menu-radio-item",
    "menu-radio-item-indicator",
    "menu-radio-item-indicator::before",
    "menu-radio-item-label",
  ],
  // Every icon part is a native slot — declared explicitly (never synthesized by the
  // walker), matching checkbox's `check-icon`/`minus-icon` pattern.
  slots: [
    {
      name: "trigger",
      part: "menu-trigger",
      required: true,
      composedChild: { component: "button" },
    },
    { name: "group-label", part: "menu-group-label", required: true },
    { name: "item-text", part: "menu-item-label", required: true },
    { name: "submenu-icon", part: "menu-submenu-icon" },
    { name: "check-icon", part: "menu-checkbox-item-indicator" },
    { name: "checkbox-item-text", part: "menu-checkbox-item-label", required: true },
    { name: "radio-item-text", part: "menu-radio-item-label", required: true },
  ],
  anatomy: {
    part: "menu-trigger",
    kind: "frame",
    layout: "vertical",
    synthetic: true,
    slots: ["trigger"],
    children: [
      {
        part: "menu-popup",
        kind: "frame",
        layout: "vertical",
        when: { popup: "open" },
        requiredBindings: ["fill"],
        children: [
          {
            part: "menu-group",
            kind: "frame",
            layout: "vertical",
            children: [
              {
                part: "menu-group-label",
                kind: "text",
                slots: ["group-label"],
                requiredBindings: ["textStyle"],
              },
              {
                part: "menu-item",
                kind: "frame",
                layout: "horizontal",
                requiredBindings: ["text"],
                children: [
                  {
                    part: "menu-item-label",
                    kind: "text",
                    synthetic: true,
                    slots: ["item-text"],
                    requiredBindings: ["textStyle"],
                  },
                  {
                    part: "menu-submenu-icon",
                    kind: "icon",
                    iconName: "CaretRight",
                    when: { submenu: "trigger" },
                    slots: ["submenu-icon"],
                  },
                ],
              },
            ],
          },
          { part: "menu-separator", kind: "rectangle" },
          {
            part: "menu-checkbox-item",
            kind: "frame",
            layout: "horizontal",
            requiredBindings: ["text"],
            children: [
              {
                part: "menu-checkbox-item-indicator",
                kind: "icon",
                iconName: "Check",
                when: { checked: "checked" },
                slots: ["check-icon"],
              },
              {
                part: "menu-checkbox-item-label",
                kind: "text",
                synthetic: true,
                slots: ["checkbox-item-text"],
                requiredBindings: ["textStyle"],
              },
            ],
          },
          {
            part: "menu-radio-group",
            kind: "frame",
            layout: "vertical",
            children: [
              {
                part: "menu-radio-item",
                kind: "frame",
                layout: "horizontal",
                requiredBindings: ["text"],
                children: [
                  {
                    part: "menu-radio-item-indicator",
                    kind: "frame",
                    when: { checked: "checked" },
                    children: [
                      {
                        part: "menu-radio-item-indicator::before",
                        kind: "rectangle",
                        requiredBindings: ["fill"],
                      },
                    ],
                  },
                  {
                    part: "menu-radio-item-label",
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
    ],
  },
  // The popup holds three kinds of item, each a Building Block with the states that apply to it:
  // a plain item (highlighted, disabled, submenu trigger), a checkbox item and a radio item
  // (checked, highlighted, disabled). The menu set has only the popup axis: a disabled state there
  // would change nothing, because the trigger has no CSS of its own.
  buildingBlocks: [
    {
      part: "menu-item",
      axes: [
        {
          prop: "highlighted",
          values: ["idle", "highlighted"],
          default: "idle",
          attribute: "data-highlighted",
          valueSelectors: { idle: null, highlighted: "[data-highlighted]" },
        },
        {
          prop: "disabled",
          values: ["enabled", "disabled"],
          default: "enabled",
          attribute: "data-disabled",
          valueSelectors: { enabled: null, disabled: "[data-disabled]" },
        },
        {
          prop: "submenu",
          values: ["none", "trigger"],
          default: "none",
          attribute: "data-submenu-trigger",
          valueSelectors: { none: null, trigger: "[data-submenu-trigger]" },
        },
      ],
    },
    {
      part: "menu-checkbox-item",
      axes: [
        {
          prop: "checked",
          values: ["unchecked", "checked"],
          default: "unchecked",
          attribute: "data-checked",
          valueSelectors: { unchecked: null, checked: "[data-checked]" },
        },
        {
          prop: "highlighted",
          values: ["idle", "highlighted"],
          default: "idle",
          attribute: "data-highlighted",
          valueSelectors: { idle: null, highlighted: "[data-highlighted]" },
        },
        {
          prop: "disabled",
          values: ["enabled", "disabled"],
          default: "enabled",
          attribute: "data-disabled",
          valueSelectors: { enabled: null, disabled: "[data-disabled]" },
        },
      ],
    },
    {
      part: "menu-radio-item",
      axes: [
        {
          prop: "checked",
          values: ["unchecked", "checked"],
          default: "unchecked",
          attribute: "data-checked",
          valueSelectors: { unchecked: null, checked: "[data-checked]" },
        },
        {
          prop: "highlighted",
          values: ["idle", "highlighted"],
          default: "idle",
          attribute: "data-highlighted",
          valueSelectors: { idle: null, highlighted: "[data-highlighted]" },
        },
        {
          prop: "disabled",
          values: ["enabled", "disabled"],
          default: "enabled",
          attribute: "data-disabled",
          valueSelectors: { enabled: null, disabled: "[data-disabled]" },
        },
      ],
    },
  ],
  axes: [
    {
      prop: "popup",
      values: ["closed", "open"],
      default: "closed",
      attribute: "data-popup",
      valueSelectors: { closed: null, open: "[data-popup-open]" },
    },
  ],
  literalGeometry: [{ part: "menu-checkbox-item-indicator", width: 16, height: 16 }],
  omittedParts: {
    "menu-backdrop":
      "position: fixed; inset: 0 (menu.css) is a window-relative claim a generated component " +
      "definition has no window to make — omitted, not rendered, not " +
      "stretched over the frame as a stand-in.",
    "menu-arrow":
      "Its along-edge position is set by Base UI/Floating UI at runtime (inline transform), never " +
      "by CSS — the same runtime-only placement gap as Slider and the popover/tooltip/" +
      "preview-card arrows (FIGMA_ANCHORED_POPUP_COMPONENTS). Menu's own docs example never renders " +
      "an Arrow child either. Generating it would misplace it at the popup's origin.",
  },
  documentation: {
    coverage: "all-axes" as const,
    examples: [
      {
        label: "Closed",
        key: {},
        slots: {
          "group-label": "Actions",
          "item-text": "Edit",
          "checkbox-item-text": "Show hidden files",
          "radio-item-text": "Ascending",
        },
      },
      {
        label: "Open",
        key: { popup: "open" },
        slots: {
          "group-label": "Actions",
          "item-text": "Edit",
          "checkbox-item-text": "Show hidden files",
          "radio-item-text": "Ascending",
        },
      },
    ],
  },
  reactToFigmaNotes: [
    "Popup flattens Base UI's runtime open state into design variants of the menu. The items are " +
      "the `menu-item`, `menu-checkbox-item` and `menu-radio-item` Building Blocks, whose highlighted, " +
      "disabled, checked and submenu states are their own variants; the popup holds an instance of " +
      "each. None of these states change menu-popup's own paint.",
    "menu-trigger has no CSS of its own (data-slot, not data-ui) — its default content is a Button " +
      "instance, the same composed-child mechanism ToggleGroup/Field use, rather than an " +
      "invented box. menu-popup is nested inside it as an ordinary flow child, gated " +
      '`when: { popup: "open" }`, the same shape select-root, combobox-root and ' +
      "autocomplete-root use (a vertical root over the field and its popup) — no positioning " +
      "fields are declared.",
    "menu-checkbox-item-indicator is declared as icon-kind anatomy (Check, a real SVG the component " +
      "already renders as CheckboxItemIndicator's default child) and covered by the declared " +
      "`check-icon` slot (every icon part must be a native slot).",
    "menu-radio-item-indicator's visible dot is `::before` (`width: 8px; height: 8px; " +
      "border-radius: 50%; background-color: currentcolor`) — a pseudo-element, not a DOM node, " +
      "resolved as a real CSS-derived anatomy part: `menu-radio-item-indicator::before` is " +
      "a rectangle child of the indicator frame, resolving to an 8x8 box with radiusPx 4 (exact " +
      "arithmetic on the literal square, the `matchRoot` precedent) and a fill bound through " +
      "the indicator's own `color` (currentcolor resolves through the HOST part's binding, never " +
      "defaulted).",
    "menu-submenu-icon is declared as icon-kind anatomy (CaretRight, a real Phosphor SVG that " +
      'SubmenuTrigger renders as a trailing child) gated `when: { submenu: "trigger" }` ' +
      "and covered by the declared `submenu-icon` slot. It replaced a `::after` caret drawn with " +
      "`rotate: 45deg` borders, which the resolver refuses; the icon is a real part so " +
      "browser and Figma match. Under RTL the icon is mirrored in CSS (`scale: -1 1`).",
    "menu-item-label / menu-checkbox-item-label / menu-radio-item-label are synthetic text children: " +
      "Menu.Item/.CheckboxItem/.RadioItem render their label directly as text content with no " +
      "wrapping data-ui element, unlike Select's separate select-item-text. Each inherits its " +
      "textStyle from its real parent part's own CSS (menu-item/menu-checkbox-item/menu-radio-item " +
      "all set font-family/size/weight/line-height/color directly on themselves).",
  ],
});
