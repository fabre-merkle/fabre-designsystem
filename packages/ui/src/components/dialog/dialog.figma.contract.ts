import { defineFigmaContract } from "../figma-contract";

export const dialogFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "dialog",
  componentName: "Dialog",
  rootPart: "dialog-popup",
  parts: [
    "dialog-popup",
    "dialog-backdrop",
    "dialog-title",
    "dialog-description",
    "dialog-header",
    "dialog-footer",
    "dialog-action-cancel",
    "dialog-action-confirm",
  ],
  slots: [
    { name: "title", part: "dialog-title", required: true },
    { name: "description", part: "dialog-description", required: true },
    // dialog.mdx's documented example wraps its two DialogClose buttons in a
    // plain inline-styled `<div>` (display: flex; gap; justify-content) — that
    // div is consumer markup, not a library-owned part (same treatment as the
    // radio-group/checkbox-group docs' inline-styled `<label>`s) — but the two
    // BUTTONS it composes are real library components the docs example renders,
    // so each becomes a composedChild rather than being left out
    // entirely: the documented example is composed, not summarised.
    {
      name: "action-cancel",
      part: "dialog-action-cancel",
      required: true,
      composedChild: {
        component: "button",
        // Sparse key: Cancel = docs' `<Button variant="secondary" mode="ghost" size="sm">`;
        // every axis left out takes Button's React default.
        variantKey: { variant: "secondary", mode: "ghost", size: "sm" },
      },
    },
    {
      name: "action-confirm",
      part: "dialog-action-confirm",
      required: true,
      composedChild: {
        component: "button",
        // Docs' `<Button variant="destructive">` — every other axis defaults.
        variantKey: { variant: "destructive", size: "sm" },
      },
    },
  ],
  anatomy: {
    part: "dialog-popup",
    kind: "frame",
    layout: "vertical",
    requiredBindings: ["fill"],
    children: [
      {
        part: "dialog-header",
        kind: "frame",
        layout: "vertical",
        children: [
          {
            part: "dialog-title",
            kind: "text",
            slots: ["title"],
            requiredBindings: ["textStyle"],
          },
          {
            part: "dialog-description",
            kind: "text",
            slots: ["description"],
            requiredBindings: ["textStyle"],
          },
        ],
      },
      {
        part: "dialog-footer",
        kind: "frame",
        layout: "horizontal",
        children: [
          {
            // Each action is a Button instance; the frame holds the composed child.
            part: "dialog-action-cancel",
            kind: "frame",
            layout: "horizontal",
            synthetic: true,
            slots: ["action-cancel"],
          },
          {
            part: "dialog-action-confirm",
            kind: "frame",
            layout: "horizontal",
            synthetic: true,
            slots: ["action-confirm"],
          },
        ],
      },
    ],
  },
  // The design-only Context axis. `viewport` (default) is the
  // popup inside its viewport stand-in frame; `component` is the bare popup. No DOM attribute
  // distinguishes them, so neither value adds a CSS constraint.
  axes: [
    {
      prop: "context",
      values: ["viewport", "component"],
      default: "viewport",
      attribute: "data-context",
      valueSelectors: { viewport: null, component: null },
    },
  ],
  viewport: {
    placement: "center" as const,
    backdropPart: "dialog-backdrop",
    reason:
      "dialog.css places dialog-popup with `position: fixed; top: 50%; left: 50%; translate: " +
      "-50% -50%` over a `position: fixed; inset: 0` dialog-backdrop that paints a scrim — both " +
      "relative to the browser window. The viewport stand-in frame models that window: the backdrop fills it from its own CSS and the popup is centred " +
      "in it. Centring is declared, not derived, because Base UI applies part of the placement " +
      "at runtime.",
  },
  documentation: {
    coverage: "all-axes" as const,
    examples: [
      {
        label: "Viewport",
        key: {},
        slots: {
          title: "Delete project?",
          description: "This action cannot be undone. All files will be permanently removed.",
        },
      },
      {
        label: "Component",
        key: { context: "component" },
        slots: {
          title: "Delete project?",
          description: "This action cannot be undone. All files will be permanently removed.",
        },
      },
    ],
  },
  reactToFigmaNotes: [
    "Dialog has no React-facing visual axes: the open/closed transition is a runtime mount " +
      "concern, not a stylable variant, so this contract documents the single shown state (title " +
      "+ description) — the same reasoning popover/tooltip/preview-card apply to their own popups.",
    "`context` is design-only and has no React prop. " +
      "`context=viewport` (default) generates the popup centred inside a viewport stand-in frame " +
      "whose width binds the existing `web/breakpoint/view` variable (switch the web mode to see " +
      "sm/md/lg), whose height hugs the popup plus padding, and whose dialog-backdrop renders from " +
      "dialog.css. The popup's `min(calc(100vw - var(--spacing-600)), 480px)` width is computed " +
      "when the contract is built: the popup fills the frame inside `spacing/600` padding on each " +
      "side (the token the CSS margin names), capped at 480px. `context=component` is the bare " +
      "popup, as generated before the frame existed. The component-set root of the viewport variant is the frame; Code " +
      "Connect and the documentation page map the popup, not the frame, to <Dialog>.",
    "dialog-trigger is a `data-slot` render-target with no `data-ui` and no co-located CSS, " +
      "rendered OUTSIDE dialog-popup entirely (a sibling in the DOM, not a descendant) — unlike " +
      "the two DialogClose buttons below, it cannot be modelled as a child of this contract's root " +
      "without inventing structure that doesn't exist in the real DOM. Left undocumented here " +
      "rather than faked, the same treatment popover.figma.contract.ts gives popover-trigger.",
    "dialog-header and dialog-footer are the real `Dialog.Header` and `Dialog.Footer` parts. " +
      "The header stacks the title over the description; the footer is a row aligned to the end " +
      "(`gap: var(--spacing-200)`), and both layouts and gaps are derived from dialog.css. " +
      "The footer stacks in reverse order below the small breakpoint; that rule sits behind a " +
      "viewport media query, so the generated footer is the row. " +
      'The two DialogClose buttons in the documented example ("Cancel" — ' +
      'variant="secondary" mode="ghost" — and "Delete" — variant="destructive") are inside ' +
      "dialog-footer, so each is a composedChild Button instance. Each sits in a frame the " +
      "markup does not author, because a composed child needs a frame to hold the instance.",
  ],
});
