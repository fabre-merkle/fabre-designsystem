import { defineFigmaContract } from "../figma-contract";

const EXAMPLE_COPY = {
  title: "Project settings",
  description: "Name, visibility and members.",
  "body-text": "Changes apply to everyone who can open this project.",
} as const;

export const cardFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "card",
  componentName: "Card",
  rootPart: "card",
  parts: [
    "card",
    "card-header",
    "card-title",
    "card-description",
    "card-content",
    "card-content-text",
    "card-footer",
    "card-footer-secondary",
    "card-footer-primary",
  ],
  slots: [
    { name: "title", part: "card-title", required: true },
    { name: "description", part: "card-description", required: true },
    // The body accepts arbitrary children, so it is a native slot. The documented sentence is only
    // its default content; a designer can replace it with anything. It fills the card's width like
    // the header and footer beside it (a block child of a column).
    { name: "content", part: "card-content", defaultContent: "anatomy", stretch: true },
    { name: "body-text", part: "card-content-text", required: true },
    // The footer holds whatever actions a consumer passes: also a native slot. The documented
    // Cancel and Save buttons are its default content.
    { name: "footer", part: "card-footer", defaultContent: "anatomy" },
    {
      name: "footer-secondary",
      part: "card-footer-secondary",
      composedChild: {
        component: "button",
        // Docs' `<Button variant="secondary" mode="ghost" size="sm">Cancel</Button>`; every
        // other axis takes Button's default.
        variantKey: { variant: "secondary", mode: "ghost", size: "sm" },
      },
    },
    {
      name: "footer-primary",
      part: "card-footer-primary",
      composedChild: {
        component: "button",
        variantKey: { size: "sm" },
      },
    },
  ],
  anatomy: {
    part: "card",
    kind: "frame",
    layout: "vertical",
    requiredBindings: ["fill", "stroke"],
    children: [
      {
        // A grid in CSS (title and description in column one, an optional action in column two).
        // The two text parts stack, so the frame is a vertical auto-layout frame.
        part: "card-header",
        kind: "frame",
        layout: "vertical",
        children: [
          {
            part: "card-title",
            kind: "text",
            slots: ["title"],
            requiredBindings: ["textStyle"],
          },
          {
            part: "card-description",
            kind: "text",
            slots: ["description"],
            requiredBindings: ["textStyle"],
          },
        ],
      },
      {
        part: "card-content",
        kind: "frame",
        layout: "vertical",
        slots: ["content"],
        children: [
          {
            part: "card-content-text",
            kind: "text",
            synthetic: true,
            slots: ["body-text"],
            requiredBindings: ["textStyle"],
          },
        ],
      },
      {
        part: "card-footer",
        kind: "frame",
        layout: "horizontal",
        when: { footer: "actions" },
        slots: ["footer"],
        children: [
          {
            part: "card-footer-secondary",
            kind: "frame",
            layout: "horizontal",
            synthetic: true,
            slots: ["footer-secondary"],
          },
          {
            part: "card-footer-primary",
            kind: "frame",
            layout: "horizontal",
            synthetic: true,
            slots: ["footer-primary"],
          },
        ],
      },
    ],
  },
  axes: [
    // Design-only: a card without a footer is a Card with no `Card.Footer` child.
    {
      prop: "footer",
      values: ["none", "actions"],
      default: "none",
      attribute: "data-footer",
      valueSelectors: { none: null, actions: null },
    },
  ],
  omittedParts: {
    "card-action":
      "Placed in the header grid's second column, spanning both text rows. Auto layout has no " +
      "grid, and a wrapper frame around the title and description would not exist in the " +
      "component, so the part is not generated. Add a control to the header's right edge by hand.",
  },
  documentation: {
    coverage: "all-axes" as const,
    examples: [
      {
        label: "Medium",
        key: {},
        slots: { ...EXAMPLE_COPY },
      },
      {
        label: "Small",
        key: { size: "sm" },
        slots: { ...EXAMPLE_COPY },
      },
      {
        label: "Large",
        key: { size: "lg" },
        slots: { ...EXAMPLE_COPY },
      },
      {
        label: "Medium with footer",
        key: { footer: "actions" },
        slots: { ...EXAMPLE_COPY },
      },
      {
        label: "Small with footer",
        key: { size: "sm", footer: "actions" },
        slots: { ...EXAMPLE_COPY },
      },
      {
        label: "Large with footer",
        key: { size: "lg", footer: "actions" },
        slots: { ...EXAMPLE_COPY },
      },
    ],
  },
  reactToFigmaNotes: [
    "`size` maps 1:1 to the React `size` prop (`data-size`, default `md`). It sets the padding and the " +
      "gap only, and every part follows it; the title and the content keep the same type at every size.",
    "`footer` is design-only: React has no prop for it, a card simply has or lacks a `Card.Footer` " +
      "child. `actions` generates the footer with the documented Cancel and Save buttons as its " +
      "default content.",
    "The surface is an Elevated: the fill, border and shadow bind the page default (surface level 3, " +
      "shadow level 1). In code a card inside another card lands two surface levels higher with the " +
      "same shadow level; place a Card inside a Card's content slot in Figma and set its fill to the " +
      "next surface level by hand.",
    "`content` and `footer` are native slots: the regions accept arbitrary children, and the " +
      "documented sentence and buttons are only their default content. Where a Figma build has no " +
      "native slots, the same nodes are placed as ordinary frames.",
    "`card-action` is not generated (see `omittedParts`). The header's title and description stack " +
      "vertically.",
  ],
});
