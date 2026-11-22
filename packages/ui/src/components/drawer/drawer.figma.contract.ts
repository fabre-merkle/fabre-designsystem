import { defineFigmaContract } from "../figma-contract";

export const drawerFigmaContract = defineFigmaContract({
  schemaVersion: 1 as const,
  slug: "drawer",
  componentName: "Drawer",
  rootPart: "drawer-popup",
  parts: [
    "drawer-popup",
    "drawer-popup::before",
    "drawer-backdrop",
    "drawer-title",
    "drawer-description",
    "drawer-checklist",
    "drawer-checklist-item",
    "drawer-checklist-control",
    "drawer-checklist-text",
    "drawer-checklist-title",
    "drawer-checklist-description",
    "drawer-actions",
    "drawer-action-cancel",
    "drawer-action-confirm",
  ],
  slots: [
    { name: "title", part: "drawer-title", required: true },
    { name: "description", part: "drawer-description", required: true },
    // The popup takes arbitrary children, so its body is a native slot that stretches across the
    // popup. The documentation example's checklist is the slot's default content: its rows are the
    // slot frame's children. A designer can swap them for anything.
    { name: "content", part: "drawer-checklist", defaultContent: "anatomy", stretch: true },
    // drawer.mdx's documented example composes four Checkbox instances, each beside a
    // `Field.Label` title over a `Field.Description`, and two DrawerClose
    // buttons — real library components the docs example renders, so each
    // becomes a composedChild (the documented example is composed, not summarised).
    {
      name: "checklist-item",
      part: "drawer-checklist-control",
      required: true,
      composedChild: { component: "checkbox" },
    },
    // The row's text is Field's own parts: a `Field.Label` title over a `Field.Description`.
    // Their typography and colour live in field.css, so each is an instance of the component built
    // from it (field-label, field-description).
    {
      name: "checklist-title",
      part: "drawer-checklist-title",
      composedChild: { component: "field-label" },
    },
    {
      name: "checklist-description",
      part: "drawer-checklist-description",
      composedChild: { component: "field-description" },
    },
    {
      name: "action-cancel",
      part: "drawer-action-cancel",
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
      part: "drawer-action-confirm",
      required: true,
      composedChild: { component: "button" },
    },
  ],
  anatomy: {
    part: "drawer-popup",
    kind: "frame",
    layout: "vertical",
    requiredBindings: ["fill"],
    children: [
      {
        // The drag handle: `drawer-popup::before`, shown on the bottom and top sheet only. The CSS
        // gate is `:not([data-side="left"]):not([data-side="right"])`, evaluated by the resolver
        // over the `side` axis; `when` keeps the node out of the left and right cells.
        part: "drawer-popup::before",
        kind: "rectangle",
        when: { side: ["down", "up"] },
        requiredBindings: ["fill"],
      },
      {
        part: "drawer-title",
        kind: "text",
        slots: ["title"],
        requiredBindings: ["textStyle"],
      },
      {
        part: "drawer-description",
        kind: "text",
        slots: ["description"],
        requiredBindings: ["textStyle"],
      },
      {
        part: "drawer-checklist",
        kind: "frame",
        layout: "vertical",
        synthetic: true,
        slots: ["content"],
        // The slot frame is the checklist wrapper div (line 29, `flexDirection: "column",
        // gap: "var(--spacing-400)"`), which authors a real token gap between the four rows.
        docsLayout: {
          gap: "var(--spacing-400)",
          source: "apps/docs/content/docs/components/drawer.mdx:29",
        },
        children: [
          {
            // One row per `<label>` in the docs example: the Checkbox beside a title over a
            // description, centred on the row, `gap: var(--spacing-300)`.
            part: "drawer-checklist-item",
            kind: "frame",
            layout: "horizontal",
            synthetic: true,
            docsLayout: {
              gap: "var(--spacing-300)",
              align: "center",
              source: "apps/docs/content/docs/components/drawer.mdx:30",
            },
            items: [
              {
                slots: {
                  "checklist-title": "Email notifications",
                  "checklist-description": "Receive updates and alerts via email",
                },
              },
              {
                slots: {
                  "checklist-title": "Push notifications",
                  "checklist-description": "Get notified directly in your browser",
                },
              },
              {
                slots: {
                  "checklist-title": "SMS alerts",
                  "checklist-description": "Critical alerts sent to your phone",
                },
              },
              {
                slots: {
                  "checklist-title": "Weekly digest",
                  "checklist-description": "A summary of activity sent every Monday",
                },
              },
            ],
            children: [
              {
                part: "drawer-checklist-control",
                kind: "frame",
                layout: "horizontal",
                synthetic: true,
                slots: ["checklist-item"],
              },
              {
                // The docs' inner `<span>`: title over description, `marginTop:
                // var(--spacing-50)` on the description.
                part: "drawer-checklist-text",
                kind: "frame",
                layout: "vertical",
                synthetic: true,
                docsLayout: {
                  gap: "var(--spacing-50)",
                  source: "apps/docs/content/docs/components/drawer.mdx:32",
                },
                children: [
                  {
                    part: "drawer-checklist-title",
                    kind: "frame",
                    layout: "horizontal",
                    synthetic: true,
                    slots: ["checklist-title"],
                  },
                  {
                    part: "drawer-checklist-description",
                    kind: "frame",
                    layout: "horizontal",
                    synthetic: true,
                    slots: ["checklist-description"],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        part: "drawer-actions",
        kind: "frame",
        layout: "horizontal",
        synthetic: true,
        // drawer.mdx's actions wrapper div (line 59, `gap: "var(--spacing-200)",
        // justifyContent: "center"`) authors a real token gap + centre alignment.
        docsLayout: {
          gap: "var(--spacing-200)",
          justify: "center",
          source: "apps/docs/content/docs/components/drawer.mdx:59",
        },
        children: [
          {
            part: "drawer-action-cancel",
            kind: "frame",
            layout: "horizontal",
            synthetic: true,
            slots: ["action-cancel"],
          },
          {
            part: "drawer-action-confirm",
            kind: "frame",
            layout: "horizontal",
            synthetic: true,
            slots: ["action-confirm"],
          },
        ],
      },
    ],
  },
  axes: [
    {
      prop: "side",
      values: ["down", "up", "right", "left"],
      default: "down",
      attribute: "data-side",
      valueSelectors: {
        down: null,
        up: '[data-side="up"]',
        right: '[data-side="right"]',
        left: '[data-side="left"]',
      },
      attributeOmittedWhenNull: true,
    },
    // The design-only Context axis. `viewport` (default) is the
    // popup docked inside its viewport stand-in frame; `component` is the bare popup. No DOM
    // attribute distinguishes them, so neither value adds a CSS constraint.
    {
      prop: "context",
      values: ["viewport", "component"],
      default: "viewport",
      attribute: "data-context",
      valueSelectors: { viewport: null, component: null },
    },
  ],
  viewport: {
    placement: "docked" as const,
    // Docking is per `side` cell: drawer.css anchors drawer-popup to the edge each `data-side`
    // value names (`down` is the bottom-sheet base rule, `up` the top sheet).
    dock: {
      axis: "side",
      edges: { down: "bottom", up: "top", right: "right", left: "left" },
    },
    backdropPart: "drawer-backdrop",
    reason:
      "drawer.css places drawer-popup with `position: fixed` and the `top`/`left`/`right`/`bottom: " +
      "0` pair its `data-side` names, over a `position: fixed; inset: 0` drawer-backdrop that " +
      "paints a scrim — both relative to the browser window. The viewport stand-in frame models " +
      "that window: the backdrop fills it from its own CSS and " +
      "the popup is docked to the edge its `side` cell names. Docking is declared, not derived, " +
      "because Base UI applies part of the placement at runtime.",
  },
  documentation: {
    coverage: "all-axes" as const,
    examples: [
      {
        label: "Down · Viewport",
        key: {},
        slots: {
          title: "Notification preferences",
          description: "Choose how and when you'd like to be notified.",
        },
      },
      {
        label: "Up · Viewport",
        key: { side: "up" },
        slots: {
          title: "Notification preferences",
          description: "Choose how and when you'd like to be notified.",
        },
      },
      {
        label: "Right · Viewport",
        key: { side: "right" },
        slots: {
          title: "Notification preferences",
          description: "Choose how and when you'd like to be notified.",
        },
      },
      {
        label: "Left · Viewport",
        key: { side: "left" },
        slots: {
          title: "Notification preferences",
          description: "Choose how and when you'd like to be notified.",
        },
      },
      {
        label: "Down · Component",
        key: { context: "component" },
        slots: {
          title: "Notification preferences",
          description: "Choose how and when you'd like to be notified.",
        },
      },
      {
        label: "Up · Component",
        key: { side: "up", context: "component" },
        slots: {
          title: "Notification preferences",
          description: "Choose how and when you'd like to be notified.",
        },
      },
      {
        label: "Right · Component",
        key: { side: "right", context: "component" },
        slots: {
          title: "Notification preferences",
          description: "Choose how and when you'd like to be notified.",
        },
      },
      {
        label: "Left · Component",
        key: { side: "left", context: "component" },
        slots: {
          title: "Notification preferences",
          description: "Choose how and when you'd like to be notified.",
        },
      },
    ],
  },
  reactToFigmaNotes: [
    "`side` is a design-only axis (down|up|right|left, default down) mirroring drawer.css's " +
      '`[data-side="down"|"up"|"left"|"right"]` edge variants. `down` carries a null selector with ' +
      "`attributeOmittedWhenNull`: drawer.css's bottom-sheet base rule is " +
      '`:not([data-side]), [data-side="down"]`, and the resolver evaluates the valueless ' +
      "`:not([data-side])` as satisfied exactly for `down` (attribute absent) and unsatisfied for the " +
      "other three (attribute present), so the rule no longer lands in REFUSED NEGATIONS. " +
      "The Drawer popup sets `data-side` itself, from the same value it passes to Base UI as `swipeDirection`. The axis documents " +
      "what drawer.css authors, one example per side. Per-side window placement is the `context` " +
      "axis's viewport stand-in frame below.",
    "The drag handle is the `drawer-popup::before` pseudo part (40x4, `radius/full`, `surface/border/5`). " +
      'drawer.css gates it on `data-side` (`:not([data-side="left"]):not([data-side="right"])`), the ' +
      "attribute the popup already carries for its edge, so the resolver evaluates the gate over the `side` " +
      "axis and the anatomy's `when: { side: [down, up] }` keeps it off the left and right cells. " +
      "Its `align-self: center` is never set on the handle itself: it moves to the popup's cross-axis alignment only when every in-flow sibling agrees or fills the cross axis, and is otherwise refused and reported. Every sibling here fills the cross axis (the title and description text, the stretching content slot and the actions), so the popup centres its contents and the handle sits centred, as in code. " +
      "Its `margin-block-start` (`spacing/300`) is the popup's own top padding: the handle is the first " +
      "in-flow child and the popup sets no top padding, so the margin maps to it exactly (the plan layer " +
      "expresses margins as the parent's padding or gap, and refuses any that would need a sum with no " +
      "matching token).",
    "`context` is design-only and has no React prop. " +
      "`context=viewport` (default) generates the popup docked inside a viewport stand-in frame " +
      "whose width binds the existing `web/breakpoint/view` variable (switch the web mode to see " +
      "sm/md/lg), whose height hugs the popup plus padding, and whose drawer-backdrop renders " +
      "from drawer.css. The popup docks to the frame edge its `side` cell names (down = bottom, " +
      "up = top, right, left — declared in `viewport.dock`, since Base UI applies part of the " +
      "placement at runtime). The margin the CSS reserves lands on the edge opposite the dock: " +
      "right/left keep `min(calc(100vw - var(--spacing-600)), 420px)` as `spacing/600` padding on " +
      "the far side with the popup capped at 420px; down/up keep `max-height: calc(100vh - " +
      "var(--spacing-600))` as `spacing/600` padding on the far block edge and span the frame " +
      "width. A right/left drawer is `top: 0; bottom: 0` — the window's full height, which a " +
      "hugging frame has no static value for — so it hugs its content vertically. " +
      "`context=component` is the bare popup, as generated before the frame existed. The " +
      "component-set root of a viewport variant is the frame; Code Connect and the documentation " +
      "page map the popup, not the frame, to <Drawer>.",
    "drawer-trigger is a `data-slot` render-target with no `data-ui` and no co-located CSS, " +
      "rendered OUTSIDE drawer-popup entirely (a sibling in the DOM, not a descendant) — it cannot " +
      "be modelled as a child of this contract's root without inventing structure that doesn't " +
      "exist in the real DOM. Left undocumented here rather than faked, the same treatment " +
      "popover.figma.contract.ts gives popover-trigger.",
    "drawer.mdx's documented example composes four Checkbox instances (email/push/sms/digest " +
      "notification toggles), each beside a `Field.Label` title over a `Field.Description` (FieldLabel and FieldDescription " +
      "instances, built from Field's stylesheet), plus two " +
      'DrawerClose buttons ("Cancel" — variant="secondary" mode="ghost" — and "Save preferences" ' +
      "at Button's own contract defaults). The documented example is composed: " +
      "each Checkbox is a composedChild (checkbox.figma.contract.ts) in one of four rows " +
      "under the `content` slot's frame (`drawer-checklist`), beside the FieldLabel and FieldDescription instances, and each Button is a composedChild under a " +
      "synthetic `drawer-actions` frame — editing Checkbox or Button propagates to every Drawer " +
      "that composes them. Both synthetic frames reproduce the docs' authored gaps via `docsLayout` " +
      "`drawer-checklist` declares `{ gap: " +
      '"var(--spacing-400)", source: "...drawer.mdx:29" }` for the gap between checklist rows, and ' +
      '`drawer-actions` declares `{ gap: "var(--spacing-200)", justify: "center", source: ' +
      '"...drawer.mdx:59" }` for the gap + centring between the two actions — both real tokens the ' +
      "docs markup itself authors, bound as Figma variables rather than guessed.",
    "`content` is the body of the drawer: the popup accepts arbitrary children, so it is a native " +
      "slot that stretches across the popup, and the notification checklist from the documented " +
      "example is only its default content. A designer can replace the rows with anything. Where a " +
      "Figma build has no native slots, the same rows are placed as ordinary frames in the same " +
      "position, so the component looks identical. Because the content frame fills the cross axis " +
      "like the title, description and actions, the popup centres its contents and the drag handle " +
      "stays centred.",
    "drawer-viewport, drawer-content, drawer-swipe-area, drawer-indent, and drawer-indent-background " +
      "are all real `data-ui` parts in drawer.tsx, but NONE of them has a single CSS rule in " +
      "drawer.css — they carry no fill/text/stroke/textStyle/effectStyle binding and no authored " +
      "geometry, so the CSS-source resolver finds nothing to bind and they never surface as a " +
      "CSS-resolvable sub-part (unlike dialog-backdrop's real background-color). They are neither " +
      "declared in `parts` nor listed in `omittedParts`, matching how every other contract in this " +
      "catalog treats a purely structural/ARIA wrapper with zero authored style.",
  ],
});
