import { defineFigmaContract } from "../figma-contract";

/**
 * Combobox. Trigger-anchored, same shape as
 * `select.figma.contract.ts` and `menu.figma.contract.ts`: the anatomy root is a
 * synthetic, unpainted vertical frame (`combobox-root`) holding the real, styled field
 * surface (`combobox-input-group` — border, background, focus ring) and, below it,
 * `combobox-popup`, gated `when: { popup: ["open", "open-empty"] }`. No positioning fields are declared.
 */
export const comboboxFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "combobox",
  componentName: "Combobox",
  rootPart: "combobox-root",
  parts: [
    "combobox-root",
    "combobox-input-group",
    "combobox-input",
    "combobox-clear",
    "combobox-trigger",
    "combobox-icon",
    "combobox-popup",
    "combobox-empty",
    "combobox-list",
    "combobox-group",
    "combobox-group-label",
    "combobox-item",
    "combobox-item-label",
    "combobox-item-indicator",
    "combobox-separator",
  ],
  // Every icon part is a native slot — declared explicitly (never
  // synthesized by the walker), matching select's caret/item-check.
  slots: [
    { name: "input-value", part: "combobox-input", required: true },
    { name: "group-label", part: "combobox-group-label" },
    { name: "item-text", part: "combobox-item-label", required: true },
    { name: "empty-text", part: "combobox-empty", required: true },
    { name: "caret", part: "combobox-icon" },
    { name: "item-check", part: "combobox-item-indicator" },
  ],
  anatomy: {
    part: "combobox-root",
    kind: "frame",
    layout: "vertical",
    synthetic: true,
    children: [
      {
        part: "combobox-input-group",
        kind: "frame",
        layout: "horizontal",
        children: [
          {
            part: "combobox-input",
            kind: "text",
            slots: ["input-value"],
            requiredBindings: ["textStyle"],
          },
          {
            // Clear's content is arbitrary caller-supplied text ("×" in one doc example,
            // never a library icon or a Phosphor glyph the tsx renders) and
            // `[data-ui="combobox-clear"]` declares no font of its own — modelled as an
            // empty box (its real, CSS-derived geometry/color) rather than inventing a
            // textStyle no stylesheet declares. Rendered unconditionally, matching the
            // docs example's own unconditional JSX (Base UI's own runtime visibility
            // logic is not a CSS-derived state this contract models).
            part: "combobox-clear",
            kind: "frame",
          },
          {
            part: "combobox-trigger",
            kind: "frame",
            layout: "horizontal",
            children: [
              { part: "combobox-icon", kind: "icon", iconName: "CaretDown", slots: ["caret"] },
            ],
          },
        ],
      },
      {
        part: "combobox-popup",
        kind: "frame",
        layout: "vertical",
        when: { popup: ["open", "open-empty"] },
        requiredBindings: ["fill"],
        children: [
          {
            part: "combobox-empty",
            kind: "text",
            when: { popup: "open-empty" },
            slots: ["empty-text"],
            requiredBindings: ["textStyle"],
          },
          {
            part: "combobox-list",
            kind: "frame",
            layout: "vertical",
            when: { popup: "open" },
            children: [
              {
                part: "combobox-group",
                kind: "frame",
                layout: "vertical",
                children: [
                  {
                    part: "combobox-group-label",
                    kind: "text",
                    slots: ["group-label"],
                    requiredBindings: ["textStyle"],
                  },
                  {
                    part: "combobox-item",
                    kind: "frame",
                    layout: "horizontal",
                    requiredBindings: ["text"],
                    children: [
                      {
                        part: "combobox-item-label",
                        kind: "text",
                        synthetic: true,
                        slots: ["item-text"],
                        requiredBindings: ["textStyle"],
                      },
                      {
                        part: "combobox-item-indicator",
                        kind: "icon",
                        iconName: "Check",
                        when: { selected: "selected" },
                        slots: ["item-check"],
                      },
                    ],
                  },
                ],
              },
              { part: "combobox-separator", kind: "rectangle" },
            ],
          },
        ],
      },
    ],
  },
  // One set holds the trigger: popup x validity x state. The item is a Building Block, so its own
  // states (selected, highlighted, disabled) multiply inside the hidden item set instead.
  buildingBlocks: [
    {
      part: "combobox-item",
      axes: [
        {
          prop: "selected",
          values: ["unselected", "selected"],
          default: "unselected",
          attribute: "data-selected",
          valueSelectors: { unselected: null, selected: "[data-selected]" },
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
      // The popup and its results are one axis: closed, open with results, or open with none.
      // `open-empty` is the Base UI `data-empty` popup (`ComboboxPopupDataAttributes.empty`), which
      // gates `combobox-empty` against `combobox-list`; this component's CSS does not style it
      // differently, so it is a structural presence gate, not a paint difference.
      prop: "popup",
      values: ["closed", "open", "open-empty"],
      default: "closed",
      attribute: "data-popup",
      valueSelectors: {
        closed: null,
        open: "[data-popup-open]",
        "open-empty": "[data-popup-open]",
      },
    },
    {
      // Real Base UI attribute (`ComboboxInputGroupDataAttributes.invalid`, set when
      // wrapped in `Field.Root`) — no docs example wraps Combobox in Field, but the
      // issue requires an "error" display variant "where supported", and this is the
      // real, reflected mechanism, matching `field.figma.contract.ts`'s own axis.
      prop: "validity",
      values: ["valid", "invalid"],
      default: "valid",
      attribute: "data-invalid",
      valueSelectors: { valid: null, invalid: "[data-invalid]" },
    },
    {
      prop: "state",
      values: ["default", "hover", "focus-visible", "disabled"],
      default: "default",
      attribute: "data-state",
      valueSelectors: {
        default: null,
        hover: ":hover",
        "focus-visible": ":focus-within",
        disabled: "[data-disabled]",
      },
    },
  ],
  literalGeometry: [
    { part: "combobox-icon", width: 16, height: 16 },
    { part: "combobox-item-indicator", width: 16, height: 16 },
  ],
  omittedParts: {
    "combobox-label":
      "Combobox.Root renders no wrapping element (a context provider only) — Label and " +
      "InputGroup are true DOM siblings, not a parent/child pair, so nesting Label inside " +
      "combobox-input-group (this contract's real, painted field surface) would " +
      "misrepresent the source structure. " +
      "Only one of Combobox's three documented examples renders a label at all, and it is " +
      'hand-authored as a bare `<label data-ui="combobox-label">`, not `<Combobox.Label>`. ' +
      "Modelling it honestly would require inventing an unreviewed synthetic wrapping frame " +
      "with no CSS of its own; flagged here rather than invented.",
    "combobox-chips":
      "Real and demonstrated (ComboboxTeamDemo), but the `multiple` prop that renders it has " +
      "no reflected DOM/CSS attribute of its own — ComboboxRoot renders no element and sets " +
      "no data-multiple marker — so there is no honest selector to gate a single/multi-select " +
      "Figma display variant on. The canonical single-select composition (ComboboxFruitDemo) " +
      "is modelled; multi-select/chips is a real, CSS-backed variant left as a reported gap " +
      "rather than a fabricated axis.",
    "combobox-chip": {
      kind: "unrepresentable-state",
      reason: "Only reachable via combobox-chips (the `multiple` state); see that entry.",
      via: "combobox-chips",
    },
    "combobox-chip-remove": "Only reachable via combobox-chips; see that entry.",
    "combobox-backdrop":
      "position: fixed; inset: 0 (combobox.css) is a window-relative claim a generated " +
      "component definition has no window to make — omitted, not " +
      "rendered, not stretched over the frame as a stand-in.",
    "combobox-arrow":
      "Its along-edge position is set by Base UI/Floating UI at runtime (inline transform), " +
      "never by CSS — the same runtime-only placement gap as Slider and the " +
      "popover/tooltip/preview-card arrows, and menu-arrow (menu.figma.contract.ts). " +
      "Combobox's own docs examples never render an Arrow child either.",
    "combobox-row":
      "A grid/row item-layout primitive not composed by any of Combobox's three documented " +
      "examples. Its only CSS-resolvable declaration is `gap` (no paint at all — no color, " +
      "background, border, or font), so omitting it loses no visual identity.",
    "combobox-status":
      "An aria-live status message, not among the required display states (closed, open, " +
      "populated, empty, selected, error, disabled) and not composed by any documented " +
      "example. Its content is dynamic result-count text with no fixed shape to model " +
      "honestly without inventing copy.",
  },
  documentation: {
    coverage: "all-axes" as const,
    examples: [
      {
        label: "Closed",
        key: {},
        slots: {
          "input-value": "Search a fruit",
          "item-text": "Apple",
          "empty-text": "No fruit found.",
        },
      },
      {
        label: "Open",
        key: { popup: "open" },
        slots: {
          "input-value": "Designer",
          "item-text": "Designer",
          "group-label": "Roles",
          "empty-text": "No fruit found.",
        },
      },
      {
        label: "Open, empty results",
        key: { popup: "open-empty" },
        slots: { "input-value": "Xyz", "item-text": "Apple", "empty-text": "No fruit found." },
      },
      {
        label: "Invalid",
        key: { validity: "invalid" },
        slots: {
          "input-value": "Search a fruit",
          "item-text": "Apple",
          "empty-text": "No fruit found.",
        },
      },
      {
        label: "Disabled",
        key: { state: "disabled" },
        slots: { "input-value": "Pick one", "item-text": "Apple", "empty-text": "No fruit found." },
      },
      {
        label: "Hover",
        key: { state: "hover" },
        slots: { "input-value": "Pick one", "item-text": "Apple", "empty-text": "No fruit found." },
      },
      {
        label: "Focused",
        key: { state: "focus-visible" },
        slots: { "input-value": "Pick one", "item-text": "Apple", "empty-text": "No fruit found." },
      },
    ],
  },
  reactToFigmaNotes: [
    "combobox-root is a synthetic, unpainted vertical root (no data-ui source part) holding " +
      "combobox-input-group, the real, styled field surface, and below it combobox-popup, gated " +
      '`when: { popup: ["open", "open-empty"] }`. The browser places the popup under its anchor, so an ' +
      "open variant stacks the two; a closed variant holds the field alone. Same shape as " +
      "menu.figma.contract.ts. The field's fill, border and radius bind on the field part. " +
      "No positioning fields are declared.",
    "popup, state and validity flatten Base UI runtime state into design variants of the field " +
      "(closed/open/open-with-no-results, default/hover/focus-visible/disabled, valid/invalid). " +
      "`popup` holds the results too: `open-empty` is the popup with no results (`data-empty`), shown " +
      "with `combobox-empty` instead of `combobox-list`. validity maps to the real, reflected Base UI " +
      "attribute `data-invalid`, which this component's own CSS layer styles on the field. " +
      "The focus ring is the State value `focus-visible` (the field's `:focus-within` outline), not " +
      "the `focus-visible` boolean property: the ring layer is generated only from a root " +
      "`:focus-visible` outline, and this root is synthetic.",
    "The item is the `combobox-item` Building Block, whose selected, highlighted and disabled " +
      "states are its own variants; the popup holds an instance of it.",
    "combobox-clear renders unconditionally (matching the docs example's own unconditional " +
      "JSX) rather than being gated on Base UI's runtime data-filled attribute, which this " +
      "component's own CSS layer doesn't style differently anyway.",
    "combobox-item-label is a synthetic text child: Combobox.Item renders its label " +
      "directly as text content with no wrapping data-ui element (same shape as " +
      "menu-item-label). It inherits its textStyle from combobox-item's own CSS " +
      "(font-family/size/weight/line-height/color declared directly on the item).",
    "Multi-select (chips), the bare-HTML label, the backdrop, the arrow, the row layout " +
      "primitive, and the status live-region are omitted — see `omittedParts` for the " +
      "specific, individually-reasoned gap each represents.",
  ],
});
