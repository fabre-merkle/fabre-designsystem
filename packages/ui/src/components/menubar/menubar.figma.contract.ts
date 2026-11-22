import { defineFigmaContract } from "../figma-contract";

export const menubarFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "menubar",
  componentName: "Menubar",
  rootPart: "menubar-root",
  parts: ["menubar-root", "menubar-trigger", "menubar-trigger-label"],
  slots: [{ name: "trigger-text", part: "menubar-trigger-label", required: true }],
  anatomy: {
    part: "menubar-root",
    kind: "frame",
    layout: "horizontal",
    layoutByAxis: {
      axis: "orientation",
      values: { horizontal: "horizontal", vertical: "vertical" },
    },
    requiredBindings: ["fill"],
    children: [
      {
        part: "menubar-trigger",
        kind: "frame",
        layout: "horizontal",
        // menubar.mdx renders three menus, File, Edit and View, each with its own trigger.
        items: [
          { slots: { "trigger-text": "File" } },
          // Only one menu is open at a time: Edit and View stay closed in the open example.
          { key: { popup: "closed" }, slots: { "trigger-text": "Edit" } },
          { key: { popup: "closed" }, slots: { "trigger-text": "View" } },
        ],
        children: [
          {
            part: "menubar-trigger-label",
            kind: "text",
            synthetic: true,
            slots: ["trigger-text"],
            requiredBindings: ["textStyle"],
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
      prop: "popup",
      values: ["closed", "open"],
      default: "closed",
      attribute: "data-popup",
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
  documentation: {
    coverage: "all-axes" as const,
    examples: [
      {
        label: "Closed",
        key: {},
        slots: { "trigger-text": "File" },
      },
      {
        label: "Open",
        key: { popup: "open" },
        slots: { "trigger-text": "File" },
      },
      {
        label: "Vertical",
        key: { orientation: "vertical" },
        slots: { "trigger-text": "File" },
      },
      {
        label: "Disabled",
        key: { state: "disabled" },
        slots: { "trigger-text": "File" },
      },
      {
        label: "Keyboard-focused",
        key: { state: "focus-visible" },
        slots: { "trigger-text": "File" },
      },
      {
        label: "Hover",
        key: { state: "hover" },
        slots: { "trigger-text": "File" },
      },
    ],
  },
  reactToFigmaNotes: [
    'MenubarTrigger wraps Menu.Trigger with data-ui="menubar-trigger" and owns real ' +
      "CSS (padding/background/radius/hover/focus-visible/disabled), so it is modelled as a native " +
      "anatomy part, not a composedChild — unlike Menu's own trigger (menu.figma.contract.ts), " +
      "which has no CSS of its own and composes a Button instead.",
    "The open cell intentionally does NOT render the Menu popup as a child. menu-anchored popups are " +
      "an ordinary flow child of their trigger, but that only works " +
      "when the trigger and popup are parts of the SAME contract (select.figma.contract.ts). Here " +
      "the popup (menu-popup, menu-item, …) is Menu's own contracted anatomy, a different slug. " +
      "`composedChild` can only " +
      "compose a whole child component rooted at that child's own `rootPart` — and Menu's " +
      "`rootPart` is `menu-trigger`, not `menu-popup` (menu.figma.contract.ts's trigger is itself " +
      'synthetic/composedChild:button). `composedChild: { component: "menu" }` from the open cell ' +
      "would therefore nest a second, redundant trigger (plus its own popup) under the already-open " +
      "Menubar trigger, not just the popup — a redraw, not a composition. Hand-authoring menu-popup's " +
      "anatomy inline in this contract was rejected too: it would duplicate a part Menu already owns " +
      'and resolve against the wrong CSS source (menubar.css has no [data-ui="menu-popup"] rule). ' +
      "The open cell is therefore differentiated only by the trigger's own [data-popup-open] " +
      "highlight (real CSS). Composing a non-root part of another contract's component would need a " +
      "schema/resolver change (e.g. a `composedChild.part` field) — not " +
      "implemented here.",
  ],
});
