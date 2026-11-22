import { defineFigmaContract } from "../figma-contract";

export const toastFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "toast",
  componentName: "Toast",
  rootPart: "toast-root",
  parts: ["toast-root", "toast-content", "toast-title", "toast-description"],
  slots: [
    { name: "title", part: "toast-title", required: true },
    { name: "description", part: "toast-description", required: true },
    // Toast.Content renders whatever children a consumer passes, so it is a native slot that
    // stretches across the card. The title over description pair from the documented example is
    // only its default content.
    { name: "content", part: "toast-content", defaultContent: "anatomy", stretch: true },
  ],
  anatomy: {
    part: "toast-root",
    kind: "frame",
    layout: "vertical",
    requiredBindings: ["fill"],
    children: [
      {
        part: "toast-content",
        kind: "frame",
        layout: "vertical",
        slots: ["content"],
        children: [
          {
            part: "toast-title",
            kind: "text",
            slots: ["title"],
            requiredBindings: ["textStyle"],
          },
          {
            part: "toast-description",
            kind: "text",
            slots: ["description"],
            requiredBindings: ["textStyle"],
          },
        ],
      },
    ],
  },
  // The design-only Context axis. `viewport` (default) is the
  // card in the bottom-right corner of its viewport stand-in frame; `component` is the bare card.
  // No DOM attribute distinguishes them, so neither value adds a CSS constraint.
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
    placement: "corner" as const,
    corner: "bottom-right" as const,
    // The corner offsets and the `min(calc(100vw - var(--spacing-600)), 380px)` width live on the
    // stacking container, not on the toast-root card this contract materializes.
    placementPart: "toast-viewport",
    reason:
      "toast.css corner-anchors the toast-viewport stacking container with `position: fixed; " +
      "bottom/right: var(--spacing-400)` and caps its width at `min(calc(100vw - " +
      "var(--spacing-600)), 380px)` — all relative to the browser window. The viewport stand-in " +
      "frame models that window: the toast card sits in its " +
      "bottom-right corner at the offsets the CSS names. The corner is declared, not derived, " +
      "because Base UI applies part of the placement at runtime. Toast has no backdrop.",
  },
  omittedParts: {
    "toast-viewport":
      "The shared stacking container sits OUTSIDE this contract's own anatomy tree: Toast's root is " +
      "toast-root (a single notification card), not toast-viewport (the multi-toast portal-level " +
      "stack it renders inside), so it is never materialized. What it carries — the `position: " +
      "fixed; bottom/right: var(--spacing-400)` corner anchor and the `min(calc(100vw - " +
      "var(--spacing-600)), 380px)` width — is what the viewport stand-in frame models " +
      "(`viewport.placementPart`), so the container's window " +
      "placement and width are resolved rather than refused.",
    "toast-arrow":
      "Its position is set by Base UI/Floating UI at runtime (inline transform, used only when " +
      "Toast is composed with an anchored `Positioner` — toast.css's own comment calls it \"optional " +
      'pointer when used with Positioner"), never by CSS — the same runtime-only placement gap ' +
      "as Slider's thumb/indicator and the popover/tooltip/preview-card arrows " +
      "(FIGMA_ANCHORED_POPUP_COMPONENTS). This contract does not model the anchored-Positioner " +
      "usage at all (Toast's canonical usage is an un-anchored viewport stack, matching every " +
      "documented example here), so there is no anchor for the arrow to point at in the first " +
      "place; generating it would misplace it at toast-root's origin.",
  },
  documentation: {
    coverage: "all-axes" as const,
    examples: [
      {
        label: "Viewport",
        key: {},
        slots: {
          title: "Changes saved",
          description: "Your project has been updated.",
        },
      },
      {
        label: "Component",
        key: { context: "component" },
        slots: {
          title: "Changes saved",
          description: "Your project has been updated.",
        },
      },
    ],
  },
  reactToFigmaNotes: [
    "Toast has no React-facing visual axes: the starting/ending-style transition is a runtime " +
      "mount concern, not a stylable variant, so this contract documents the single shown state " +
      "(title + description) — the same reasoning Dialog/AlertDialog/Drawer and " +
      "popover/tooltip/preview-card apply to their own popups.",
    "`context` is design-only and has no React prop. " +
      "`context=viewport` (default) generates the card in the bottom-right corner of a viewport " +
      "stand-in frame whose width binds the existing `web/breakpoint/view` variable (switch the " +
      "web mode to see sm/md/lg) and whose height hugs the card plus padding. toast.css places " +
      "and sizes the toast-viewport container, not toast-root, so `viewport.placementPart` reads " +
      "that part: its `bottom`/`right: var(--spacing-400)` bind `spacing/400` as the frame's " +
      "bottom and right padding by name, and its `min(calc(100vw - var(--spacing-600)), 380px)` " +
      "width makes the card fill the frame up to 380px with `spacing/600` padding on the far " +
      "(left) side, by name. That reserves more than the CSS at the narrowest mode, the same " +
      "accepted trade as the other viewport components. Toast has no backdrop. `context=component` " +
      "is the bare card, as generated before the frame existed. The component-set root of the " +
      "viewport variant is the frame; Code Connect and the documentation page map the card, not " +
      "the frame, to <Toast>.",
    "`content` is the body of the toast: Toast.Content accepts arbitrary children, so it is a " +
      "native slot that stretches across the card, and the title over description pair from the " +
      "documented example is only its default content. A designer can replace them with anything. " +
      "Where a Figma build has no native slots, the same title and description are placed as " +
      "ordinary frames in the same position, so the card looks identical.",
    "toast-action and toast-close are `data-slot` render-target with no `data-ui` and no co-located " +
      "CSS — Toast never styles either, and both are arbitrary consumer elements (typically another " +
      "library component, e.g. Button). Left undocumented here rather than faked, the same treatment " +
      "popover.figma.contract.ts gives popover-trigger.",
    "toast-positioner (Positioner) is a `data-slot` render-target with no co-located CSS — it only " +
      "matters for the anchored-arrow usage this contract does not model (see toast-arrow above).",
  ],
});
