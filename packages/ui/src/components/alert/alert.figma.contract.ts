import { defineFigmaContract } from "../figma-contract";

const INTENTS = ["info", "success", "warning", "error"] as const;

const INTENT_ICONS = {
  info: "InfoFill",
  success: "CheckCircleFill",
  warning: "WarningFill",
  error: "WarningCircleFill",
} as const;

const EXAMPLE_COPY = {
  info: { title: "Heads up", description: "A new token release is available." },
  success: { title: "Changes saved", description: "Your workspace settings are up to date." },
  warning: { title: "Unsaved changes", description: "You have edits that haven't been saved." },
  error: { title: "Couldn't publish", description: "Check your connection and try again." },
} as const;

export const alertFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "alert",
  componentName: "Alert",
  rootPart: "alert",
  parts: [
    "alert",
    "alert-icon",
    "alert-icon-info",
    "alert-icon-success",
    "alert-icon-warning",
    "alert-icon-error",
    "alert-content",
    "alert-title",
    "alert-description",
    "alert-actions",
    "alert-action-primary",
    "alert-action-secondary",
  ],
  slots: [
    // Every icon part is a native slot, declared explicitly.
    ...INTENTS.map((intent) => ({ name: `${intent}-icon`, part: `alert-icon-${intent}` })),
    { name: "title", part: "alert-title", required: true },
    { name: "description", part: "alert-description", required: true },
    {
      name: "action-primary",
      part: "alert-action-primary",
      required: true,
      // Docs' `<Button size="sm">Save</Button>`; every other axis at Button's default.
      composedChild: {
        component: "button",
        variantKey: { size: "sm" },
      },
    },
    {
      name: "action-secondary",
      part: "alert-action-secondary",
      required: true,
      // Docs' `<Button size="sm" variant="secondary" mode="stroke">Discard</Button>`.
      composedChild: {
        component: "button",
        variantKey: { variant: "secondary", mode: "stroke", size: "sm" },
      },
    },
  ],
  anatomy: {
    part: "alert",
    kind: "frame",
    layout: "horizontal",
    requiredBindings: ["fill"],
    children: [
      {
        // `display: inline-flex` in alert.css: an auto-layout frame that hugs the one visible
        // glyph. An overlay frame has no hug, so it would keep Figma's 100px default width and
        // push the text to x=121.
        part: "alert-icon",
        kind: "frame",
        layout: "horizontal",
        children: INTENTS.map((intent) => ({
          part: `alert-icon-${intent}`,
          kind: "icon" as const,
          iconName: INTENT_ICONS[intent],
          when: { intent },
          slots: [`${intent}-icon`],
        })),
      },
      {
        part: "alert-content",
        kind: "frame",
        layout: "vertical",
        children: [
          {
            part: "alert-title",
            kind: "text",
            slots: ["title"],
            requiredBindings: ["text", "textStyle"],
          },
          {
            part: "alert-description",
            kind: "text",
            slots: ["description"],
            requiredBindings: ["text", "textStyle"],
          },
          {
            part: "alert-actions",
            kind: "frame",
            layout: "horizontal",
            when: { actions: "buttons" },
            children: [
              {
                part: "alert-action-primary",
                kind: "frame",
                layout: "horizontal",
                synthetic: true,
                slots: ["action-primary"],
              },
              {
                part: "alert-action-secondary",
                kind: "frame",
                layout: "horizontal",
                synthetic: true,
                slots: ["action-secondary"],
              },
            ],
          },
        ],
      },
    ],
  },
  axes: [
    {
      prop: "actions",
      values: ["none", "buttons"],
      default: "none",
      attribute: "data-actions",
      valueSelectors: { none: null, buttons: null },
    },
  ],
  documentation: {
    coverage: "all-axes" as const,
    examples: [
      ...INTENTS.map((intent) => ({
        label: `${intent[0].toUpperCase()}${intent.slice(1)}`,
        key: { intent },
        slots: { ...EXAMPLE_COPY[intent] },
      })),
      {
        label: "Warning with actions",
        key: { intent: "warning", actions: "buttons" },
        slots: { ...EXAMPLE_COPY.warning },
      },
    ],
  },
  reactToFigmaNotes: [
    "`intent` maps 1:1 to the React `intent` prop (`data-intent`). Each intent shows its default " +
      "Phosphor fill icon; in React a first-child svg (or an element with `data-icon`) is laid out " +
      "in the icon column by CSS and hides the default. In Figma that is the icon slot.",
    "`actions` is design-only: React has an `actions` prop that renders `alert-actions` only when " +
      "it is passed, with no DOM attribute. `buttons` composes the two Buttons from the docs " +
      "example (Save, Discard) as composed children in synthetic frames inside the real " +
      "`alert-actions` part.",
    "`role` (`alert` for error, `status` otherwise) is accessibility semantics with no visual " +
      "difference, so it is not an axis.",
  ],
});
