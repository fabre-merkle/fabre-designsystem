import { defineFigmaContract } from "../figma-contract";

/**
 * Autocomplete. Trigger-anchored, mirroring
 * `combobox.figma.contract.ts`'s shape — but NOT copying its stale part assumptions
 * (per the issue's own instruction): Autocomplete's canonical, documented composition
 * (`autocomplete.mdx`) has no disclosure caret and no chips, unlike Combobox. The
 * anatomy root is a synthetic, unpainted vertical frame (`autocomplete-root`) holding the
 * real, styled field surface (`autocomplete-input-group`) and, below it, `autocomplete-popup`,
 * gated `when: { popup: ["open", "open-empty"] }` — same shape as `select.figma.contract.ts` /
 * `menu.figma.contract.ts`. No positioning fields are declared.
 */
export const autocompleteFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "autocomplete",
  componentName: "Autocomplete",
  rootPart: "autocomplete-root",
  parts: [
    "autocomplete-root",
    "autocomplete-input-group",
    "autocomplete-input",
    "autocomplete-clear",
    "autocomplete-popup",
    "autocomplete-empty",
    "autocomplete-list",
    "autocomplete-group",
    "autocomplete-group-label",
    "autocomplete-item",
    "autocomplete-item-label",
    "autocomplete-separator",
  ],
  slots: [
    { name: "input-value", part: "autocomplete-input", required: true },
    { name: "group-label", part: "autocomplete-group-label" },
    { name: "item-text", part: "autocomplete-item-label", required: true },
    { name: "empty-text", part: "autocomplete-empty", required: true },
  ],
  anatomy: {
    part: "autocomplete-root",
    kind: "frame",
    layout: "vertical",
    synthetic: true,
    children: [
      {
        part: "autocomplete-input-group",
        kind: "frame",
        layout: "horizontal",
        children: [
          {
            part: "autocomplete-input",
            kind: "text",
            slots: ["input-value"],
            requiredBindings: ["textStyle"],
          },
          {
            // Clear renders arbitrary caller text ("Clear" in the docs example, never a
            // Phosphor glyph) and `[data-ui="autocomplete-clear"]` declares no font of its
            // own — modelled as an empty box (its real CSS-derived geometry/color) rather
            // than inventing a textStyle no stylesheet declares. Rendered unconditionally,
            // matching the docs example's own unconditional JSX. Same treatment as
            // combobox-clear.
            part: "autocomplete-clear",
            kind: "frame",
          },
        ],
      },
      {
        part: "autocomplete-popup",
        kind: "frame",
        layout: "vertical",
        when: { popup: ["open", "open-empty"] },
        requiredBindings: ["fill"],
        children: [
          {
            part: "autocomplete-empty",
            kind: "text",
            when: { popup: "open-empty" },
            slots: ["empty-text"],
            requiredBindings: ["textStyle"],
          },
          {
            part: "autocomplete-list",
            kind: "frame",
            layout: "vertical",
            when: { popup: "open" },
            children: [
              {
                part: "autocomplete-group",
                kind: "frame",
                layout: "vertical",
                children: [
                  {
                    part: "autocomplete-group-label",
                    kind: "text",
                    slots: ["group-label"],
                    requiredBindings: ["textStyle"],
                  },
                  {
                    part: "autocomplete-item",
                    kind: "frame",
                    layout: "horizontal",
                    requiredBindings: ["text"],
                    children: [
                      {
                        part: "autocomplete-item-label",
                        kind: "text",
                        synthetic: true,
                        slots: ["item-text"],
                        requiredBindings: ["textStyle"],
                      },
                    ],
                  },
                ],
              },
              { part: "autocomplete-separator", kind: "rectangle" },
            ],
          },
        ],
      },
    ],
  },
  // One set holds the trigger: popup x validity x state. The item is a Building Block, so its own
  // states (highlighted, disabled) multiply inside the hidden item set instead.
  buildingBlocks: [
    {
      part: "autocomplete-item",
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
      ],
    },
  ],
  axes: [
    {
      // The popup and its results are one axis: closed, open with results, or open with none.
      // `open-empty` is the popup with no results (`data-empty`), which gates `autocomplete-empty`
      // against `autocomplete-list`; this component's CSS does not style it differently, so it is
      // a structural presence gate, not a paint difference.
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
  omittedParts: {
    "autocomplete-trigger":
      'Real (`[data-ui="autocomplete-trigger"]`), but not composed by either of ' +
      "Autocomplete's documented examples — its own CSS comment calls it \"rare; group is " +
      "usually the field\". Autocomplete's canonical, documented composition is search-as-" +
      "you-type with no disclosure control, unlike Combobox's caret trigger " +
      "(combobox.figma.contract.ts) — a real, intentional difference this contract " +
      "preserves rather than copying Combobox's trigger/icon shape onto a component whose " +
      "own docs never render one. Only `gap` (no paint at all) is CSS-resolvable on it, so " +
      "omitting it loses no visual identity.",
    "autocomplete-icon":
      "Real (`color`), but only reachable inside autocomplete-trigger above, which is " +
      "itself omitted — neither of Autocomplete's documented examples renders an Icon.",
    "autocomplete-backdrop":
      "position: fixed; inset: 0 (autocomplete.css) is a window-relative claim a generated " +
      "component definition has no window to make — omitted, not " +
      "rendered, not stretched over the frame as a stand-in.",
    "autocomplete-arrow":
      "Its along-edge position is set by Base UI/Floating UI at runtime (inline transform), " +
      "never by CSS — the same runtime-only placement gap as Slider and the " +
      "popover/tooltip/preview-card arrows, menu-arrow, and combobox-arrow. Autocomplete's " +
      "own docs examples never render an Arrow child either.",
    "autocomplete-row":
      "A grid/row item-layout primitive not composed by either documented example. Its " +
      "only CSS-resolvable declaration is `gap` (no paint at all), so omitting it loses no " +
      "visual identity.",
    "autocomplete-status":
      "An aria-live status message, not among the required display states (closed, open, " +
      "populated, empty, selected, error, disabled) and not composed by either documented " +
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
          "input-value": "Search fruit...",
          "item-text": "Apple",
          "empty-text": "No matches.",
        },
      },
      {
        label: "Open, grouped",
        key: { popup: "open" },
        slots: {
          "input-value": "React",
          "item-text": "React",
          "group-label": "Frontend",
          "empty-text": "No matches.",
        },
      },
      {
        label: "Open, empty results",
        key: { popup: "open-empty" },
        slots: { "input-value": "Xyz", "item-text": "React", "empty-text": "No matches." },
      },
      {
        label: "Invalid",
        key: { validity: "invalid" },
        slots: {
          "input-value": "Search fruit...",
          "item-text": "Apple",
          "empty-text": "No matches.",
        },
      },
      {
        label: "Disabled",
        key: { state: "disabled" },
        slots: {
          "input-value": "Search fruit...",
          "item-text": "Apple",
          "empty-text": "No matches.",
        },
      },
      {
        label: "Hover",
        key: { state: "hover" },
        slots: {
          "input-value": "Search fruit...",
          "item-text": "Apple",
          "empty-text": "No matches.",
        },
      },
      {
        label: "Focused",
        key: { state: "focus-visible" },
        slots: {
          "input-value": "Search fruit...",
          "item-text": "Apple",
          "empty-text": "No matches.",
        },
      },
    ],
  },
  reactToFigmaNotes: [
    "autocomplete-root is a synthetic, unpainted vertical root (no data-ui source part) holding " +
      "autocomplete-input-group, the real, styled field surface, and below it autocomplete-popup, gated " +
      '`when: { popup: ["open", "open-empty"] }`. The browser places the popup under its anchor, so an ' +
      "open variant stacks the two; a closed variant holds the field alone. Same shape as " +
      "menu.figma.contract.ts. The field's fill, border and radius bind on the field part. " +
      "No positioning fields are declared.",
    "popup, state and validity flatten Base UI runtime state into design variants of the field " +
      "(closed/open/open-with-no-results, default/hover/focus-visible/disabled, valid/invalid). " +
      "`popup` holds the results too: `open-empty` is the popup with no results (`data-empty`), shown " +
      "with `autocomplete-empty` instead of `autocomplete-list`. validity maps to the real, " +
      "reflected Base UI attribute `data-invalid`, which this component's own CSS layer styles on " +
      "the field. The focus ring is the State value `focus-visible` (the field's `:focus-within` " +
      "outline), not the `focus-visible` boolean property: the ring layer is generated only from a " +
      "root `:focus-visible` outline, and this root is synthetic.",
    "The item is the `autocomplete-item` Building Block, whose highlighted and disabled states are " +
      "its own variants; the popup holds an instance of it. It has no selected state: Autocomplete " +
      "never selects an item (Base UI fixes its selection mode to none).",
    "autocomplete-clear renders unconditionally (matching the docs example's own " +
      "unconditional JSX) rather than being gated on Base UI's runtime data-filled " +
      "attribute, which this component's own CSS layer doesn't style differently anyway.",
    "autocomplete-item-label is a synthetic text child: Autocomplete.Item renders its " +
      "label directly as text content with no wrapping data-ui element. It inherits its " +
      "textStyle from autocomplete-item's own CSS (font-family/size/weight/line-height/" +
      "color declared directly on the item).",
    "No item-check/ItemIndicator part exists — Autocomplete.Item has no such sub-component " +
      "(unlike Combobox.ItemIndicator).",
    "The trigger/icon disclosure control, backdrop, arrow, row layout primitive, and " +
      "status live-region are omitted — see `omittedParts` for the specific, " +
      "individually-reasoned gap each represents.",
  ],
});
