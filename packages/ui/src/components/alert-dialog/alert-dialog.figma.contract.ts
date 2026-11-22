import { defineFigmaContract } from "../figma-contract";

export const alertDialogFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "alert-dialog",
  componentName: "AlertDialog",
  rootPart: "alert-dialog-popup",
  parts: [
    "alert-dialog-popup",
    "alert-dialog-backdrop",
    "alert-dialog-title",
    "alert-dialog-description",
    "alert-dialog-header",
    "alert-dialog-footer",
    "alert-dialog-action-cancel",
    "alert-dialog-action-confirm",
  ],
  slots: [
    { name: "title", part: "alert-dialog-title", required: true },
    { name: "description", part: "alert-dialog-description", required: true },
    // Same composition as Dialog's: the documented example's two AlertDialogClose buttons
    // ("Keep account" secondary/ghost, "Delete" destructive) are real library components inside alert-dialog-popup, so each is a composedChild.
    {
      name: "action-cancel",
      part: "alert-dialog-action-cancel",
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
      part: "alert-dialog-action-confirm",
      required: true,
      composedChild: {
        component: "button",
        // Docs' `<Button variant="destructive">` — every other axis defaults.
        variantKey: { variant: "destructive", size: "sm" },
      },
    },
  ],
  anatomy: {
    part: "alert-dialog-popup",
    kind: "frame",
    layout: "vertical",
    requiredBindings: ["fill"],
    children: [
      {
        part: "alert-dialog-header",
        kind: "frame",
        layout: "vertical",
        children: [
          {
            part: "alert-dialog-title",
            kind: "text",
            slots: ["title"],
            requiredBindings: ["textStyle"],
          },
          {
            part: "alert-dialog-description",
            kind: "text",
            slots: ["description"],
            requiredBindings: ["textStyle"],
          },
        ],
      },
      {
        part: "alert-dialog-footer",
        kind: "frame",
        layout: "horizontal",
        children: [
          {
            // Each action is a Button instance; the frame holds the composed child.
            part: "alert-dialog-action-cancel",
            kind: "frame",
            layout: "horizontal",
            synthetic: true,
            slots: ["action-cancel"],
          },
          {
            part: "alert-dialog-action-confirm",
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
    backdropPart: "alert-dialog-backdrop",
    reason:
      "alert-dialog.css places alert-dialog-popup with `position: fixed; top: 50%; left: 50%; " +
      "translate: -50% -50%` over a `position: fixed; inset: 0` alert-dialog-backdrop that paints " +
      "a scrim — both relative to the browser window. The viewport stand-in frame models that " +
      "window: the backdrop fills it from its own CSS and the " +
      "popup is centred in it. Centring is declared, not derived, because Base UI applies part of " +
      "the placement at runtime.",
  },
  documentation: {
    coverage: "all-axes" as const,
    examples: [
      {
        label: "Viewport",
        key: {},
        slots: {
          title: "Discard changes?",
          description: "You have unsaved changes that will be lost if you continue.",
        },
      },
      {
        label: "Component",
        key: { context: "component" },
        slots: {
          title: "Discard changes?",
          description: "You have unsaved changes that will be lost if you continue.",
        },
      },
    ],
  },
  reactToFigmaNotes: [
    "AlertDialog has no React-facing visual axes: the open/closed transition is a runtime mount " +
      "concern, not a stylable variant, so this contract documents the single shown state (title + " +
      "description) — identical reasoning to Dialog, and to popover/tooltip/preview-card.",
    "AlertDialog is CSS-identical to Dialog (same backdrop/popup/title/description rules, " +
      "alert-dialog.css vs dialog.css) — the two contracts diverge only in slug/part names, mirroring " +
      "how the components themselves diverge only in Base UI primitive (`AlertDialog` enforces a " +
      "non-dismissible, confirmation-only modal at the React layer; nothing about that distinction " +
      "is expressible in CSS or a Figma variant).",
    "`context` is design-only and has no React prop. " +
      "`context=viewport` (default) generates the popup centred inside a viewport stand-in frame " +
      "whose width binds the existing `web/breakpoint/view` variable (switch the web mode to see " +
      "sm/md/lg), whose height hugs the popup plus padding, and whose alert-dialog-backdrop " +
      "renders from alert-dialog.css. The popup's `min(calc(100vw - var(--spacing-600)), 480px)` " +
      "width is computed when the contract is built: the popup fills the frame inside " +
      "`spacing/600` padding on each side (the token the CSS margin names), capped at 480px. " +
      "`context=component` is the bare popup, as generated before the frame existed. Identical " +
      "mechanism to Dialog's. The component-set root of the viewport variant is the frame; Code " +
      "Connect and the documentation page map the popup, not the frame, to <AlertDialog>.",
    "alert-dialog-trigger is a `data-slot` render-target with no `data-ui` and no co-located CSS, " +
      "rendered OUTSIDE alert-dialog-popup entirely (a sibling in the DOM, not a descendant) — " +
      "unlike the two AlertDialogClose buttons below, it cannot be modelled as a child of this " +
      "contract's root without inventing structure that doesn't exist in the real DOM. Left " +
      "undocumented here rather than faked, the same treatment popover.figma.contract.ts gives " +
      "popover-trigger.",
    "alert-dialog-header and alert-dialog-footer are the real `AlertDialog.Header` and `AlertDialog.Footer` parts. " +
      "The header stacks the title over the description; the footer is a row aligned to the end " +
      "(`gap: var(--spacing-200)`), and both layouts and gaps are derived from alert-dialog.css. " +
      "The footer stacks in reverse order below the small breakpoint; that rule sits behind a " +
      "viewport media query, so the generated footer is the row. " +
      'The two AlertDialogClose buttons in the documented example ("Keep account" — ' +
      'variant="secondary" mode="ghost" — and "Delete" — variant="destructive") are inside ' +
      "alert-dialog-footer, so each is a composedChild Button instance. Each sits in a frame the " +
      "markup does not author, because a composed child needs a frame to hold the instance.",
  ],
});
