---
name: skill-contribute-component
summary: Build and update components, contracts and docs.
description: This skill should be used when authoring a new UI component in a scaffolded project, or changing an existing one — composing it on Base UI, wiring the data-attribute API, writing token-driven CSS in the correct cascade layer, and wiring its exports. Any component create/change MUST then update the docs via skill-contribute-docs AND the component's Figma generation contract (its *.figma.contract.ts); a contract is required for every visual component, whether or not a Figma option was chosen. Brand-agnostic, so it travels into scaffolded projects unchanged.
version: 2026.11.09
---

# Contribute Component

This skill is the build mechanics for authoring a UI component: how to compose it on
[Base UI](https://base-ui.com/react/overview/quick-start), express its API as `data-*` attributes,
write CSS that resolves to the design tokens in the right cascade layer, and
export it from your UI package. This is a **white-label** design system, so everything
here is brand-neutral.

It is **not** where you decide whether a component should exist or what it should look like. Those
visual and motion decisions (layout, hierarchy, token choices, variants, transitions,
interactivity) are out of scope here — make them deliberately and record the reasoning in the PR;
the Base UI mechanics that constrain them live in **skill-base-ui-handbook**. If a component would
be genuinely new to the system (not a restyle of a Base UI primitive), confirm it belongs before
building.

A scaffolded project is a Bun + Turborepo monorepo: components are source-only in
`packages/ui`, consumed by the apps via `transpilePackages`, and tokens come from Tokens Studio
(never hand-edited).

## 1 — Before you build

Confirm all four. If any fails, stop and reconsider whether this is the right contribution.

- **It's a real component — and you know its kind.** Every component is a **primitive**,
  **composed**, or **chart**:
  - **Primitive** — taken 1:1 from a [Base UI](https://base-ui.com) v1.9 component, restyled with
    the design tokens (at most additive styling props). Most components are primitives;
    they stay in lockstep with Base UI. Name the source primitive in the component's doc comment.
  - **Composed** — composed from our primitives or built new. As a
    guideline it _should_ compose existing primitives and follow Base UI's composition patterns, but
    it is **not** required to wrap a Base UI primitive. The one hard rule: **never reinvent a
    primitive Base UI already provides.** A new composed component is a bigger commitment than a
    restyle — confirm it belongs in the system first.
  - **Chart** — a data-visualisation component. Charting is its own domain; coordinate before adding one.
- **It maps to semantic tokens.** Every colour, space, radius, and type value resolves to a
  `--color-*` / `--spacing-*` / `--radius-*` / `--typography-*` token. If the design needs a value
  with no token, that's a token gap — raise it, don't hardcode.
- **It's product-agnostic.** No app-specific copy, layout, or data. This is a white-label system;
  a component belongs to the system, not to any one product.
- **It doesn't already exist.** Search `packages/ui/src/components/`.

## 2 — Compose it (the build)

### Base UI mechanics — consult `skill-base-ui-handbook` first (REQUIRED)

Before composing, **load `skill-base-ui-handbook`** — the brand-agnostic distillation of the five
Base UI v1.9 handbook pages (composition, customization/styling, animation, forms, TypeScript). It is
the standing reference for *how Base UI expects to be composed, re-tagged, styled, animated, and
typed*; this skill only adds the design-system layer (tokens, `@layer`). The rules that bite most:
the `render` prop + `useRender` (no `forwardRef`), `mergeProps` for prop merging, the lifecycle
data-attributes for animation, the `React.ComponentProps<typeof Primitive>` props pattern, and — for
any form control — the **Field / Fieldset / Form** composition + validation wiring (handbook §4). It
is installed at `.agents/skills/skill-base-ui-handbook/SKILL.md`.

### API design — apply `vercel-composition-patterns` first (REQUIRED)

Before settling a component's prop/part shape, **load and apply the `vercel-composition-patterns`
skill** (add it with `bunx --bun skills@1.7.6 add https://github.com/vercel-labs/agent-skills --skill vercel-composition-patterns`).
It is the standing gate for every component create/change — not optional. The rules that bite most
often in this design system:

- **Enumerated variants, never boolean-mode proliferation.** A visual axis is a `data-*` enum
  (`data-variant`, `data-size`, `data-tone`) — never a pile of `isX` booleans whose combinations
  explode into impossible states. (This is already this design system's `data-*` convention below; the skill is why.)
- **A gated prop cluster → a compound part.** If 2+ props only make sense when another prop is set
  (e.g. `glowColor`/`glowOpacity`/`glowSpread` gated on `accent="glow"`), that's the smell. Model it
  as a child part — `<Card.Glow color … />` — whose *presence* is the flag. No impossible states, and
  it extends to siblings (`<Card.AccentLine>`) without growing the parent's prop surface.
- **Context over variant props.** When a parent surface should drive a child's look, derive it from
  context (a descendant CSS rule keyed off the parent's `data-*`, or `use()` of a shared context) —
  not a prop the consumer must set. e.g. a `Stat` inside `surface="brand"` picks up its on-brand
  treatment from the ancestor; it has no `variant="on-brand"` prop.
- **Compound components share state via context, children over `renderX` props.** Complex components
  are `Root` + parts reading a shared context; consumers compose the parts they need.
- **React 19: no `forwardRef`; `use()` not `useContext()`** (already enforced below).

Record the composition decision in the PR description (which axes are props vs parts, and why). When
in doubt, prefer the part.

### Stateful & interactive components — apply `vercel-react-best-practices` (REQUIRED)

If the component holds state, runs effects, or attaches event listeners — a Provider, a
controlled/uncontrolled widget, a keyboard handler — **load and apply the `vercel-react-best-practices`
skill** alongside composition-patterns. Same standing gate; same install
(`bunx --bun skills@1.7.6 add https://github.com/vercel-labs/agent-skills --skill vercel-react-best-practices`).
The rules that bite most often in this design system:

- **Controlled/uncontrolled is the Provider's job.** Accept `defaultX` (uncontrolled seed) **and** `x`
  + `onXChange` (controlled); resolve with `const x = xProp ?? internal`, and drive internal state
  only when `xProp === undefined`. The Provider is the single place that knows how state is managed
  (`state-decouple-implementation`).
- **Memoize the context value.** Wrap the context object in `useMemo` so consumers don't re-render on
  every parent render.
- **Keep action handlers referentially stable.** A `toggle` / `setX` exposed through context must not
  be recreated each render — use functional `setState(prev => …)` or a latest-value ref so its
  identity holds (`rerender-functional-setstate`, `advanced-use-latest`). An unstable handler in a
  `useEffect` dependency array silently tears down and re-subscribes the effect on every change — the
  exact bug that ships a `window` listener that re-binds on every toggle.
- **Global event listeners subscribe once.** `window` / `document` listeners (keyboard shortcuts,
  resize) go in a `useEffect` keyed on the *config*, not a per-render callback; read the latest
  handler through a ref. Mark scroll/touch listeners `passive`, and always return a cleanup
  (`client-event-listeners`, `client-passive-event-listeners`).
- **Derive, don't store.** Compute derived values (an `isCollapsed` boolean, a `state` string) during
  render — never sync them into state with an effect (`rerender-derived-state-no-effect`).

Pure styling wrappers over a Base UI primitive (most primitives) don't need this pass — it's for the
components that own state or effects.

File layout — one directory per component under `packages/ui/src/components/<name>/`:

```text
packages/ui/src/components/<name>/
├── <name>.tsx     # implementation (parts) — has "use client"
├── <name>.css     # styles  (import "./<name>.css" at the top of the .tsx)
└── index.ts       # barrel — NO "use client"; for compounds it ALSO assembles
                   #   the namespace object (see the compound rule below)
```

Rules:

- **`"use client"`** at the top of `<name>.tsx` — it holds the parts, which use Base UI / hooks
  (client-only). The sibling `index.ts` stays a plain module (no directive); that split is
  load-bearing for compounds (see below).
- **Base UI is an untouched dependency.** Compose its primitives via deep imports; **never edit Base
  UI's source or re-author its structure** — doing so breaks adopting upstream fixes. When you need a
  Base UI behaviour, mirror its pattern in *our* wrapper, don't fork the dependency.
- **Deep Base UI imports only** — `import { Button as ButtonPrimitive } from "@base-ui/react/button"`.
  Never the package barrel.
- **Icon imports.** Import named from `@phosphor-icons/react` — Phosphor is the default UI icon set,
  static SVG with no runtime, and the apps' `optimizePackageImports` rewrites the barrel to per-icon
  paths so nothing drags in the full set (`bundle-barrel-imports`).
- **No `forwardRef`.** Base UI threads the ref via the `useRender` pattern. A simple wrapper spreads
  onto the primitive; a primitive-less part (a plain element) uses
  `useRender({ defaultTagName, ... })`.
- **Props type** = the primitive's props plus our additive axes, so every Base UI prop, event, ARIA
  attribute, and the polymorphic `render` prop stays available:

  ```tsx
  export type ButtonProps = React.ComponentProps<typeof ButtonPrimitive> &
    Partial<{ variant: ButtonVariant; mode: ButtonMode; size: ButtonSize }>;
  ```

- **Express the API as `data-*` attributes** on the root, with defaults applied in the component.
  These are the CSS hooks. `data-ui` comes **first** in the spread, before `{...rest}`, on every part
  — that ordering is the intentional design-system convention so a consumer can never accidentally overwrite a
  part's identity. Add the other axes only where the component actually needs them:

  | Attribute | Axis | Example values | Where it's used today |
  |---|---|---|---|
  | `data-ui` | which part this is | `"button"`, `"card-title"` | every part, always — spread first |
  | `data-size` | dimension | `sm` `md` `lg` | most sized controls |
  | `data-variant` | semantic colour/role | `primary` `secondary` `tertiary` `destructive` | interactive/colour-bearing controls (e.g. Button) |
  | `data-mode` | fill treatment | `filled` `stroke` `lighter` `ghost` | controls with multiple fills (e.g. Button) |
  | `data-tone` | status / role | `neutral` `info` `success` `warning` `critical` | status indicators (e.g. Badge, Meter) |

  Reuse the **established axis name** for the component's role rather than inventing a synonym — a
  status indicator uses `data-tone` (like Badge), not `data-variant`. Boolean-ish flags emit the
  attribute or `undefined`: `data-icon-only={isIconOnly || undefined}`.

  ```tsx
  <ButtonPrimitive data-ui="button" data-variant={variant} data-mode={mode} data-size={size} {...rest} />
  ```

- **A condition the component knows is a data attribute it sets, not a `:has()` or position selector.**
  When a style depends on something the component can state itself (its panel is open, its field is
  invalid, an icon is present), set a flag from React (`data-panel-open={open || undefined}`) and write
  the CSS against it. Base UI already sets many (`data-open`, `data-invalid`, `data-disabled`,
  `data-popup-open`), so check before adding your own. Reach for `:has()` or `:first-child` only for
  what React cannot see, such as an icon a component renders itself, whose svg the parent never
  inspects. Button and Toggle go attribute first (`data-icon-side`, from the svg and `data-icon`
  children they can see) and keep the `:has()` rules as a fallback for the rest. The browser renders
  both the same. The Figma contract compiler maps an attribute selector straight onto a variant axis,
  and reads `:has()`, `:not(:has())`, `:first-child`, `:last-child` and `:only-child` only against the parts the contract's anatomy renders in each cell, so a rule written
  as an attribute reaches Figma with no extra work, and a structural rule warns (`selector-skipped`)
  when the anatomy cannot settle it.

- **Every design variant axis prop declares an explicit default.** A prop with a finite set of string-literal values (`size`, `variant`, `mode`, `tone`, `intent`, `kind`, `color`, `weight`, `orientation`) that the Figma contract compiler derives as an axis from a local union type used on that prop (`type ButtonSize = "sm" | "md" | "lg"`) must carry its default in the component's own parameters: a destructuring default in the first parameter (`size = "md"`), or, when a parent supplies the value, a nullish chain assigned in the component's own body that starts with the destructured prop and ends in a literal (`const resolved = size ?? group?.size ?? "md"`). The default is read only from the component's own declaration (by name, or `Root` for a compound component), never from another function or a JSX attribute. Reason: the compiler reads each axis default from the component source, and refuses a component without one (`axis-default-missing`) instead of guessing the first value. Do not rely on the union's first member or on a CSS `:not([data-size])` fallback.

  ```tsx
  // Good: the default is visible in the signature
  function Button({ size = "md", variant = "primary", ...rest }: ButtonProps) {}
  // Good: inherited, still starts with the prop and ends in a literal
  function Badge({ size, ...rest }: BadgeProps) {
    const resolved = size ?? group?.size ?? "md";
  }
  // Bad: undefined flows through, the axis has no default
  function Button({ size, variant, ...rest }: ButtonProps) {}
  ```

  Exceptions, which need no default: controlled/uncontrolled props (`value`, `checked`, `open`, where `undefined` means uncontrolled), booleans (`undefined` is `false`) and optional content props (`icon`, `children`).

- **Document each prop the component declares with JSDoc.** Give each prop one sentence. When a
  declared default exists, add `@default "<value>"` matching the parameter default or the final
  literal of an approved nullish chain (`@default "md"` for `size = "md"`). Do not add `@default`
  when the prop has no declared default. The docs prop tables and editor hover text are generated
  from these comments, so a missing or mismatched comment shows up as a wrong or empty row.

- **Compound components** (Card, Accordion, Tabs) — each part is its **own named function** (not a
  shared factory) so the `"use client"` boundary emits a distinct client reference per export, and
  each part takes a `render` prop so it can be re-tagged (`<CardTitle render={<h3 />} />`).
  Style-bearing parts carry `data-ui`; pure render-target wrappers (a Trigger/Close that's typically
  replaced via `render`) carry `data-slot` instead — `data-slot` is a semantic marker, **never** a
  CSS hook, so re-tagging doesn't clobber the inner part's styling.

- **Assemble the compound namespace in `index.ts`, never in the `"use client"` `.tsx`.** Export the
  parts individually from `<name>.tsx`, then build the namespace object in the plain (no-directive)
  `index.ts` and re-export *that* from the package barrel:

  ```tsx
  // accordion.tsx  ("use client")
  export function Root(props) { /* … */ }
  export function Item(props) { /* … */ }
  // …

  // accordion/index.ts  — NO "use client"
  import { Item, Root /* … */ } from "./accordion";
  export const Accordion = { Root, Item /* … */ };
  ```

  **Why it's mandatory:** if you write `export const Accordion = { Root, … }` inside the `"use client"`
  file, a React Server Component that imports `Accordion` receives **one opaque client reference** —
  `Accordion.Root` is `undefined` at render and React throws _"Element type is invalid… got:
  undefined."_ Assembling the object in a plain module makes each `.Root` a real,
  individually-renderable client reference. This is exactly how Base UI structures its own compounds
  (parts are `"use client"`; `index.parts` assembles the namespace in a non-client module) — mirror
  it. Flat, non-namespaced exports (`Button`, `Badge`, `CardGlow`, `Metric`) are unaffected; only the
  `X.Y` dot-API needs this.

  > Every compound already follows this — the namespace is assembled in `index.ts`, never in
  > the `"use client"` `.tsx`. So a React Server Component can import any compound and render its
  > dot-parts (`Accordion.Root`, `Meter.Track`, …) directly; no flat-re-export shim is needed. When
  > you add a new compound, match the existing ones.

- **Icons are children; icon-only is a size.** Do not add `startIcon`, `endIcon`, `iconOnly` or `icon`
  props. The consumer passes the icon as a child, first or last. The CSS infers the side (a bare icon
  component renders an `svg`, and a design tool's code output cannot add attributes to it), and
  `data-icon="inline-start"` or `"inline-end"` is optional and wins where present. The CSS sizes any `svg` or `[data-icon]` child from the control's icon token. An
  icon-only control is a square size value (`icon`, `icon-xs`, `icon-sm`, `icon-lg`, the heights of
  `md`, `xs`, `sm`, `lg`).

- **A11y guards belong in the component**, dev-only. Write the gate as exactly
  `process.env.NODE_ENV` (the form bundlers replace at build time; optional chaining such as
  `process?.env?.NODE_ENV` is not replaced and fails where `process` is undefined). e.g. an
  icon-only control throws in development if it has no accessible name:

  ```tsx
  const isIconOnly = size.startsWith("icon");
  if (
    process.env.NODE_ENV === "development" &&
    isIconOnly &&
    !hasTextContent(children) &&
    !("aria-label" in rest) &&
    !("aria-labelledby" in rest)
  )
    throw new Error("Button: an icon-only button requires aria-label or aria-labelledby.");
  ```

- **Merge props with `mergeProps` — never hand-concatenate.** When a part assembles its own props
  (`data-*`, `className`, `style`, handlers) alongside the consumer's — especially compound parts that
  thread a `render` prop — combine them with `mergeProps<"div">(ourProps, userProps)`
  ([`@base-ui/react/merge-props`](https://base-ui.com/react/utils/merge-props)) so handlers chain,
  `className` / `style` compose, and the ref merges. `useRender`
  ([docs](https://base-ui.com/react/utils/use-render)) merges internally; reach for `mergeProps` when
  you build the prop object yourself.

- **CSP discipline — no un-nonceable injected markup.** Never inject a `<style>` / `<script>` via
  `dangerouslySetInnerHTML`: it's blocked under a consumer's Content-Security-Policy (no nonce). Base
  UI's [`CSPProvider`](https://base-ui.com/react/utils/csp-provider) nonces only Base UI's *own*
  injected styles, and there is no public hook to nonce a custom tag. Put rules in the co-located
  `.css`; for dynamic values, set inline `style` CSS-variables on the element
  (`style={{ "--color-x": token }}`) and read them in CSS. (This is why a chart component exposes
  `--color-<key>` via inline style, not an injected `<style>`.)

## 3 — CSS & cascade-layer discipline

This is where components most often break. Read it twice.

- **All component styles go in `@layer components { … }`.** This is the de-facto layer every existing
  component CSS file uses. The global cascade order is declared in the consuming app's global
  CSS. Putting styles in the layer is what lets semantic-token and theme layers cascade correctly
  underneath.

- **Never ship unlayered component CSS** — and here's why it bites: unlayered rules beat *any*
  `@layer` rule regardless of specificity. An unlayered `[data-ui="card-title"]` will silently
  override the layered package rule. This is a real failure mode: a stray prototype `Card` with
  unlayered styles once overrode the shipped Card's title size, and no specificity bump could fix it —
  only removing the unlayered duplicate did. If a style isn't applying and the token resolves
  correctly, suspect an unlayered or duplicate selector before anything else.

- **Cross-component context overrides stay in-layer — win by specificity, never by going unlayered.**
  When one component must restyle *inside* another's context (e.g. a `Button` on a
  `[data-finish="brand"]` Card surface has to invert to on-brand colours), the fix is a
  **more-specific layered descendant selector**, not an unlayered rule. The base Button rule
  `[data-ui="button"][data-variant][data-mode]` is `(0,3,0)` (`:hover` `(0,4,0)`), so a
  `[data-finish="brand"] [data-ui="button"][data-variant][data-mode]` rule is `(0,4,0)` / `:hover`
  `(0,5,0)` and wins *within* `@layer components` — no `!important`, no unlayered escape. Two
  requirements: the consumed component must emit the disambiguating `data-*` for the selector to match
  (Button always emits `data-variant` + `data-mode`), and you co-locate the override in the
  **consumed component's** CSS (`button.css`), keyed off the ancestor context — a component owns how
  it adapts to the surfaces it can land on.

- **`data-ui` values are global selectors.** `[data-ui="card-title"]` matches *every* card title on
  the page, from any source. So:
  - **One `data-ui` value = one visual part, owned by exactly one component.** Never reuse a part's
    `data-ui` name in a second implementation. Two components claiming `[data-ui="card"]` will fight,
    and (per the rule above) an unlayered one wins.
  - When you retire a prototype in favour of a shipped component, **delete the prototype's CSS** —
    don't leave it loading alongside the real one.

- **Token governance:** values are `var(--token)`, `calc(var(--token) * N)`, or
  `color-mix(in oklch, <token>, transparent N%)`. No raw hex, px font sizes, ms durations, or
  cubic-beziers. Reference **semantic** tokens directly (`--color-primary-brand`, `--spacing-300`,
  `--radius-large-elements`, `--typography-paragraph-lg-font-size`).
  - **Don't consume the Tokens-Studio component tokens** (`--button-*` etc., the `@layer component`
    layer). They're a reference scaffold for minting component-level tokens *if* the system ever needs
    them; today nothing reads them — not even Button, which goes straight to semantic tokens. Current
    policy: no component tokens in use.
  - It **is** expected to define **scoped, component-local** values in your own CSS — a local custom
    property, or a `calc()` / `color-mix()` derivation (e.g. dropping a token's opacity for a
    hover/pressed state). That's per-component usage at the CSS layer, distinct from consuming the
    Studio component tokens.

- **Motion:** enumerate transition properties (never `transition: all`); hover rules inside
  `@media (hover: hover)`; pair every transition with a `@media (prefers-reduced-motion: reduce)`
  reset. The full set of Base UI animation hooks (`[data-starting-style]`, `[data-ending-style]`,
  opacity-before-unmount) is in **skill-base-ui-handbook** §3.

### Controls, type and surfaces

The system has one model for interactive elements and one for raised surfaces. Follow both; never
hand-roll heights, type sizes or shadows.

- **A Control** is an interactive element with a **single-line label** and a **fixed height**, used
  inline with other Controls (Button, Toggle, ToggleGroup item, Tab, Input, Select trigger, Combobox,
  Autocomplete, NumberField, sidebar row). Ask: single-line label, fixed height, sits inline with
  other Controls? Underline tabs, Textarea and the labels of Checkbox, Radio and Switch take Control
  *text only* (no fixed height). Accordion triggers, menu items, option cards and Badge are not
  Controls. Every Control is also an *interactive element*, whose boundary needs 3:1 contrast
  (`--color-control-border`); not every interactive element is a Control.
- **Token recipe.** A Control sizes itself from `--control-height-{xs,sm,md,lg}`,
  `--control-padding-x-*`, `--control-gap-*`, `--control-icon-*` and `--typography-control-{sm,md,lg}-*`
  (`xs` and `sm` both use `control.sm`). Declare each size's full tier; no component-local aliases.
  Icon-only Controls are square (`min-width` = height, no inline padding).
- **Text and density.** Control text is `max(12px, paragraph xs/sm/md)` at the active breakpoint, so it
  follows the base size (14/16/18 by default). Product UI uses `paragraph.sm` for body, `paragraph.xs`
  for meta, `headline.xs`/`headline.sm` for titles and `control.*` for Control labels.
  `paragraph.md` and `paragraph.lg` are for editorial UI (long-form reading) only.
- **Segmented rule.** A segmented Control is one Control tall: the track is `--control-height-*`
  padded by `--control-inset` on the `--color-surface-selected` overlay (10%); items are
  `height − 2 × inset` tall with an inner radius of `radius − inset`; the selected item is a raised chip
  (`--color-surface-level-2` + `--shadow-level-2` + edge). A **joined** ToggleGroup always draws
  the track; a **gapped** one never does.
- **Touch and press.** Under `@media (pointer: coarse)` the `sm` and `md` heights become
  `--control-target-min` (44px), set once in the shared `control.css`; import it, don't redeclare it.
  Its selector matches the token root list (`:root, [data-brand], [data-theme], [data-web]`) so nested
  scopes keep the touch height. sm and md are equal on touch, so a value derived from their difference
  (an inset like `(md − sm) / 2`) needs a floor, for example `max(border + control-inset, …)`.
  Set `touch-action: manipulation`. An enabled Control scales to `0.96` while pressed, only under
  `prefers-reduced-motion: no-preference`. Hover styles live in `@media (hover: hover)`.
- **Tonal emphasis.** Primary is `{brand}-brand`, Secondary is `{brand}-container` (hover
  `containerHover`, pressed `containerSelected`), Tertiary is transparent with `surface-hover` /
  `surface-selected`. One emphasis per action.
- **Surface levels.** Two independent knobs. The **surface level** (1–8) sets the fill and the edge:
  1 page · 3 card/popover · 5 dialog · 7 popover in a dialog. A surface's level is its **substrate** (the
  level it opens on) plus an offset (bar +1, card/popover/menu/select/combobox +2, dialog/drawer/toast +4,
  clamped to 8), read from the level context (`Elevated`, `SurfaceLevel`, `useSurfaceLevel`; context
  passes through portals). This is not `SurfaceProvider`, which sets breakpoints. The **shadow level**
  (1–8) sets only the drop shadow, from a per-component default (card 1, tooltip 2, popover/menu 3,
  toast 4, dialog 5); nesting never raises it. Pick levels, never a ramp step: use
  `--color-surface-level-N` and `--shadow-level-M`, not `neutral-N`. Recessed fills (code blocks, table
  headers, tracks) are `--color-surface-recessed`, not a lower level. A raised surface at level N paints
  edge `--color-surface-border-<N+1>` (clamped at 8). Compose it in CSS:
  `border: 1px solid <edge>; background-clip: padding-box; box-shadow: inset 0 1px 0
  var(--color-surface-highlight), var(--shadow-level-M)`. The border keeps the edge in forced-colors mode.
  Hover paints `--color-surface-hover` over the fill as a `background-image: linear-gradient(...)` layer and
  keeps the edge. In light mode levels 3–8 share one fill and one edge, so the shadow carries the depth there.
  Size a pinned shadow by visual weight (a recommendation): about 3 for a surface under 400px wide, 5 for
  400–800px, 7 for over 800px or fullscreen. `Elevated` warns in development when `shadowLevel - level`
  exceeds the headroom in `--elevation-shadow-headroom` (default 2; 8 turns it off). Any element can opt in with `data-surface-level` and
  `data-shadow-level`. A selected item is `--color-surface-selected` plus the primary border, never
  secondary or tertiary. Concentric corners: inner radius = outer radius - inset - border, never below 0
  (the parent publishes `--inner-radius: calc(var(--radius-default) - <border> - <gap>)`; the child uses `max(0px, var(--inner-radius, <own radius>))`; the floor is `--radius-inset-minimum`, which follows the default radius unless the brand sets it to none: `--inner-radius: min(<outer>, max(var(--radius-inset-minimum), calc(<outer> - <border> - <gap>)))`). In the Figma contract every computed corner radius, nested corners included, binds the brand's default radius (`radius/default`) and is listed under `radiusFallbacks`. **Tooltips are the exception**: an inverted
  `--color-on-surface` fill with `--color-on-surface-inverted` text, no level, on the overlay stacking
  tier. Use only the tokens named here; older surface, edge and border names are retired. Full guide: the Surfaces & elevation
  page in the docs.
- **Attribution.** Surface levels adapt ideas from **Fluid Functionalism** by Micka Touillaud (MIT: the substrate + offset model, `Elevated`, translucent overlays) and **Cubby UI** by joncoronel (MIT: light mode on shadow, dark on colour, the dark rim and highlight), and the 1px ring from **interfaces.dev** by Jakub Krehel (concept only). Code copied or adapted from either MIT project keeps its copyright notice in the file header.

CSS shape:

```css
@layer components {
  [data-ui="button"] { /* base */ }
  [data-ui="button"][data-size="sm"] { /* size */ }
  [data-ui="button"][data-variant="primary"][data-mode="filled"] {
    background: var(--color-primary-brand);
    color: var(--color-primary-on-brand);
  }
  @media (hover: hover) {
    [data-ui="button"][data-variant="primary"][data-mode="filled"]:hover { /* … */ }
  }
}
```

Keep comments terse — single-line section markers (`/* Sizes */`), and multi-line notes only for
genuinely non-obvious things (a `@container` literal-px deviation, a `data-*` TS cast). No header
essays; the type unions and selectors are self-documenting.

## 4 — Wire up its exports

1. **Barrel** — `packages/ui/src/components/<name>/index.ts` re-exports the component + types (for a
   **compound**, it also *assembles* the namespace — see §2). Add the same to the package root
   `packages/ui/src/index.ts` (alphabetical). For a compound, the root barrel must re-export the value
   **from the folder index** (`export { <Name> } from "./components/<name>"`), not from the `.tsx`, so
   the RSC-safe namespace is the one that ships.
2. **Package export** — add `"./<name>"` to `packages/ui/package.json` `exports`.

## 5 — Document it + author stories (mandatory handoff)

**A component is not done until its docs AND stories are in sync.** Every new component, and every
change to a component's variants / modes / sizes / props / parts, requires both:

1. A documentation contribution — **switch to `skill-contribute-docs`** (see below).
2. A Storybook story update — **switch to `skill-storybook-author`** if Storybook is installed
   (`packages/ui/.storybook/main.ts` exists): the component must have a
   `packages/ui/src/components/<name>/<name>.stories.tsx` that covers the updated variants. If the
   story is missing or stale, the Storybook MCP will give agents outdated context.

**For the documentation handoff, switch to `skill-contribute-docs`** and apply, in order:

1. its **Universal documentation requirements** (human-readable titles, sidebar `meta.json`,
   sync-with-source, verification — these apply to every doc contribution); then
2. its **Contributing a component** section — the component-specific specifics: the MDX page anatomy
   (`ComponentShowcase` hero, Installation, Usage, API `AutoTypeTable`, `## Variants`), the
   `apps/docs/lib/component-registry.ts` entry that powers the live preview + source tabs, and the
   change→doc-edit sync mandate.

Do not consider this skill's work complete until `skill-contribute-docs` has run for the component you touched.

## 6 — Keep the per-component Figma contract in sync (required for every visual component)

Code→Figma generation is deterministic because every visual component declares a co-located V2
contract at:

```text
packages/ui/src/components/<name>/<name>.figma.contract.ts
```

The project's contract compiler (`packages/contracts`, run through the
`figma:contract` script) resolves that declarative contract against the component's matching `.tsx`
and `.css`, then the plugin and skill flows consume the resulting portable data. A contract is
required whether or not you chose a Figma option when scaffolding.

**Author/update the contract:**

- **`<name>.figma.contract.ts`** — keep `slug`, `componentName`, `rootPart`, `parts`, anatomy,
  documented examples, slots, and any reviewed design-only axes in sync with the component source.
  The resolver derives token bindings from CSS; do not hand-author `bindFor` maps or a second
  plugin catalogue.
- **Pointer, keyboard and availability states are one `state` axis, never a two-value axis per
  flag.** Its values are `default`, `hover`, `active`, `focus-visible` and `disabled`, in that order,
  limited to the ones the component's CSS defines (always starting with `default`). Each maps to the
  selector the stylesheet already uses (`:hover`, `:active`, `:focus-visible` or `:focus-within`,
  `[data-disabled]`) through `valueSelectors`, with `default: null`. Only `disabled` maps to a code
  prop (`codeProps`); `hover`, `active` and `focus-visible` are browser states with nothing to set. Declare it
  as the last axis. Validity, selection, a toggle's on state and an open popup stay separate axes,
  and none of them may be named `state`.
- **Coverage is explicit.** A visual component enters the artifact by declaring a co-located
  contract. A component with no visual output of its own (a context provider, a shared stylesheet)
  has no contract; say why in the PR rather than writing an empty one.
- **Geometry remains reviewed.** Put non-CSS Figma geometry only in
  `packages/contracts/figma-layout.config.ts`; do not put paint, typography, spacing, or behavior there.
- **Figma-only values live in the contract, never in a token.** Do not add a design token only so a
  contract can use it; tokens describe the CSS. Where the component's CSS defines the value (a
  `min()` width and its margin token), the contract build computes it from the CSS; where only the
  runtime knows it, the contract declares it per documentation example.

**Verify:**

```bash
bun run figma:contract         # rebuild .agents/figma-generation-contract.json
bun run figma:contract:check   # fail on drift
```

The check verifies that `.agents/figma-generation-contract.json` matches the current co-located
contracts, component source, CSS-derived bindings, and reviewed geometry. Fix the contract, source,
CSS until it passes.

### Will it actually generate? (read before you author the contract)

`figma:contract:check` passing does **not** mean the component generates *well*. Every static gate
was green for every defect found in the last plugin release UAT — including a component that
generated as an illegible 20px stub — and they only surfaced when the plugin ran against real
Figma. These are the traps, as authoring rules:

**0. The `layout` you author OVERRIDES the component's CSS. Get it right or nothing else matters.**
The anatomy's `layout` wins over the direction derived from the stylesheet, because `"overlay"` is
something CSS cannot express at all. Two consequences, and the Slider hit both at once:

- **A bare direction ignores an orientation axis.** Slider declared `layout: "vertical"` while its
  CSS is `display: flex` with the default `flex-direction: row`. Column was applied to all 96
  variants, including every horizontal one, so the value stacked above the control instead of
  sitting beside it. When direction depends on an axis, key it:

  ```ts
  layout: "horizontal",
  layoutByAxis: { axis: "orientation", values: { horizontal: "horizontal", vertical: "vertical" } },
  ```

- **`layout: "overlay"` is not a synonym for "has positioned children".** It sets
  `layoutMode: "NONE"`, and Figma's `FILL` sizing is only legal for a child of an **auto-layout**
  frame. Declare it on an ordinary flex row and every descendant that relies on `flex: 1 1 auto`
  silently refuses with `"100% outside an auto-layout parent"`. Slider's control is
  `display: flex; align-items: center` — a row — but was declared `"overlay"`, which is why its
  track had nothing to fill and the whole component collapsed to the width of its thumb.

  **The rule:** declare `"overlay"` only for the part whose own **children** are absolutely
  positioned — not for its ancestors, and not because the component "looks stacked".

**0b. An overlay child needs `overlayCrossAlign`; it will not place itself.**
A child of an `overlay` parent is emitted at that parent's origin, because CSS
does not say where it goes — Base UI positions a Slider's thumb and indicator at runtime with
inline styles, and the `align-items: center` that IS in the stylesheet belongs to the *control*
and centres the *track*. Declare the intent on the anatomy node:

| Value | Means | Example |
|---|---|---|
| `"center"` | centre on the parent's cross axis | a thumb straddling its rail |
| `"stretch"` | span the parent's cross axis | an indicator as thick as its rail |
| `"start"` / `"end"` | flush to one cross edge | a bottom-anchored underline |

Position **along** the parent is not expressible yet — that depends on a value.
The cross axis is the parent's shorter side, so this is unambiguous for a rail.

**0c. `flex: 1 1 auto` works; `width: 100%` on a root does not.**
Both mean "fill" to a CSS author, and they behave differently here:

- `flex-grow` (or the `flex` shorthand) on a flex child maps to Figma's FILL on the parent's
  main axis. Relying on it is correct, and needs no declaration.
- `width: 100%` on the component-set ROOT has nothing to fill — see rule 4b.
- Either one **under an `overlay` parent** is refused, because Figma's FILL is only legal for a
  child of an auto-layout frame. If a part must fill, its parent must not be an overlay.

**1. A part that overlays a sibling is not fully representable.**
Backdrops, indicators on a track, thumbs. Declare the parent `layout: "overlay"` in the anatomy so
the generated page validates, but know that overlay children are emitted at the parent's origin with
no offsets — a thumb will not sit partway along its track, nor centre on it. Stacking also comes from two places, and
only one is visible to the resolver: CSS (`position: fixed`), **or the runtime** — Base UI positions
Slider's indicator and thumb with inline styles, so the stylesheet never declares it and no static
check can predict it.

**1b. A sub-part's axis can be the INVERSE of the root's — declare it with `partValueSelectors`.**
A separator's own orientation is the opposite of its toolbar's — Base UI gives a horizontal toolbar a
vertical separator. So one axis value must select opposite rules for the root and for that part.
`valueSelectors` is axis-level and applies to every part uniformly, so the naive fix reads the WRONG
rule. Add a per-part override on the same axis, keyed by the part's `data-ui` name:

```ts
valueSelectors: { horizontal: '[data-orientation="horizontal"]', vertical: '[data-orientation="vertical"]' },
partValueSelectors: {
  "toolbar-separator": {
    horizontal: '[data-orientation="vertical"]',
    vertical: '[data-orientation="horizontal"]',
  },
},
```

It applies only to a selector compound that names that part; an ancestor compound naming the root
still reads the axis-level mapping. Encode the library's documented behaviour this way — never force
the attribute on the wrapper to suit the generator.

**2. Geometry belongs on frame parts, not text parts.**
A `cornerRadius` on a text part throws `invalid field for text node: 'cornerRadius'`. The walker now
skips and reports it rather than aborting, but the binding is silently doing nothing. Put radius,
padding and size on the frame that wraps the text.

**A region that accepts arbitrary children is a native slot, not synthetic nodes.** Declare the
slot with `defaultContent: "anatomy"` on the frame part that renders it, add `stretch: true` when
the CSS fills the region, and make the documented example that frame's children (its default
content). Synthetic nodes are only for layout wrappers with no content role (an actions row, a row
inside the default content). `defaultContent` cannot be combined with `composedChild`, and its part
must be a frame with children.

**Worked example: a region that accepts arbitrary children.** A drawer's popup renders whatever
children a consumer passes, so its body is a stretching slot and the documented checklist is only
its default content:

```ts
slots: [{ name: "content", part: "drawer-body", defaultContent: "anatomy", stretch: true }],
anatomy: {
  part: "drawer-popup", kind: "frame", layout: "vertical",
  children: [
    { part: "drawer-title", kind: "text", slots: ["title"] },
    {
      part: "drawer-body", kind: "frame", layout: "vertical", synthetic: true, slots: ["content"],
      docsLayout: { gap: "var(--spacing-400)", source: "<docs file>:<line>" },
      children: [/* the documented rows: composed instances, one per item */],
    },
    { part: "drawer-actions", kind: "frame", layout: "horizontal", synthetic: true },
  ],
},
```

The slot frame fills the popup like the title and actions beside it, so the popup can centre a
child such as a drag handle. Where the Figma build has no native slots, the same rows render as a
plain frame. Slots inside the default content are placed as plain content.

**2b. An `<input>` is a box with text in it — never `kind: "text"`.**
`toolbar-input` was declared `kind: "text"` while `[data-ui="toolbar-input"]` carries height,
`padding-inline`, `border-radius` and a background as well as its text. Figma splits those:
`cornerRadius` and padding do not exist on a text node, so it threw the same
`invalid field for text node: 'cornerRadius'` on every cell AND silently dropped the box. The fix is
a frame that carries the slot, which is what `input.figma.contract.ts` already does for the
standalone `<input>`. Generalise the rule: if one DOM element carries both a box and text, it is a
FRAME with the slot on it.

**2c. A `null` valueSelector means "the unqualified base rule" — only use it when such a state exists.**
The `toolbar` contract declared `valueSelectors: { horizontal: null, vertical: '[data-orientation="vertical"]' }`.
But Base UI always sets `data-orientation`, and every sizing rule is scoped to it — the unqualified
`[data-ui="toolbar-separator"]` rule carries only colour. So the resolver read a rule with no
dimensions and `toolbar-separator` generated as Figma's 100x100 default square, which also inflated
the whole Toolbar to 100 tall. Rule: if the attribute is ALWAYS present in the DOM, no value is "the
base rule" — give every value a real selector.

**3. Token references are slash-nested and verbatim.**
`color/onSurface/subtle` — **not** `color-on-surface-subtle`, and not `color/on-surface/subtle`.
The DTCG path is the name; hyphen-flattening it resolves nowhere and fails as a missing variable.

**4. A theme role is not a token.**
`documentationTheme` in `packages/contracts/contracts.config.ts` has a **closed vocabulary** of roles
(`page`, `section`, `text`, `textSubtle`, `divider`, …). The role is the key; a real token path is
the value. Inventing a role name, or putting a role name where a token belongs, produces a phantom
token that resolves nowhere — and because the same config is templated into every scaffold, it ships.

**4b. `width: 100%` on a component-set ROOT has nothing to fill — declare it, don't excuse it.**
A root is never a real auto-layout child, so `inline-size: 100%` can never resolve. That is a
geometry declaration waiting to be made in the layout manifest, not a refusal to document:
`input` declares 240px, `separator` and `slider` declare 320px, each with a reviewed reason.

Before adding anything to the exclusion list, **check whether a sibling component was FIXED for the
same cause**. Slider sat excluded for months with a reason almost word-for-word `separator`'s, while
`separator` carried a declared width — the identical cause fixed for two components and refused for
a third. An exclusion whose reason matches an existing manifest entry's is the tell.

Two limits worth knowing before you write one: a manifest entry may carry only `width`, `height`,
`aspectRatio`, `when` and `reason` (a hard boundary, guarded at runtime), and there is **one entry
per part** with `when` scoping the whole entry — so a part cannot declare a horizontal width *and* a
vertical height. Scope to the orientation that needs it and exclude the other with an honest reason.

**5. A refused size is expected output, not a failure.**
`width: 100%` outside auto-layout, `8ch`, `50%`, `calc()` over runtime variables — the generator refuses
what it cannot determine rather than guessing, and reports it non-blocking. A run that lists refusals
and completes has succeeded. Read the **blocking** channel, not the report length.

**5b. Figma has no proportional sizing, and constraints will not rescue you.**
`radio-indicator` is `inline-size: 50%` of a root that is itself a known token-bound box, and it
still generates at 100x100. `matchRoot` (`packages/contracts/figma-layout.config.ts`) is legitimate at 100%
only because it degenerates to an IDENTITY — the child is bound to the same live Figma variable the
root carries — and there is no binding for "half of variable X". Figma constraints do not re-evaluate
when a variable-bound dimension changes, so a baked literal plus a `SCALE` constraint does not
substitute either. Treat a fractional size of a variable-bound root as refused, not a manifest entry
away from fixed.

**6. A token must exist in Figma, not just in DTCG — and it must be CURRENT, not merely present.**
`radius/smallElements` is defined in `semantic-web/border.json` and still blocked generation, because
the Figma file's local variables had not been synced. Same for `color/surface/level/*`. Defining
a token and publishing it to Figma are two separate acts; the plugin reports missing variables and
missing text styles together, with the remedy for each.

Presence isn't the whole story either: for an entire UAT round the Figma file's spacing scale was
1.5x the token source, so every component generated 1.5x too large while every gate stayed green.
The tell was an internal inconsistency, not a missing-variable error — `spacing/100` (a pure alias in
the DTCG) tracked correctly while every arithmetic step (`x N`, baked to a literal at sync time) was
frozen at an older base value. Re-sync tokens before judging a generation run, and if sizes look
wrong, compare an aliased token against an arithmetic one.

**7. The resolver follows one custom-property hop and one `calc()` shape — nothing richer.**
`flex-grow` (or the `flex` shorthand) on a flex child maps to Figma FILL on the parent's main axis
(rule 0c) — rely on it. Two narrower shapes resolve now too: a component-local custom property whose
own value is exactly one `var(--token)` reference resolves one hop to that token and binds it (e.g.
`--switch-inline-size: var(--spacing-900);`), and `calc(<number> * var(--token))` (either operand
order) resolves to a literal px, recomputed from the token's live value on every build. Anything
richer stays refused — two `var()`s, additions, nested `calc()`, a local alias wrapped in `calc()` or
carrying a fallback. Switch-thumb's `calc(var(--switch-block-size) - var(--switch-padding) * 2 -
var(--stroke-width-selected) * 2)` — three locals, two operators — is exactly that shape, and stays
refused on purpose.

**So: run the plugin before you call a component done, and LOOK at what it made.** A green
`figma:contract:check` proves the contract is internally consistent with the source. It proves
nothing about whether Figma will accept the result, and nothing at all about whether the result is
usable. Slider passed every gate while generating as a 20px stub with its label in the wrong place.

A cheap triage when output looks wrong: read the run's unsized report and count. Refusals
concentrated on **one axis of one orientation** are usually an honest CSS limit. Refusals spread
across **every cell of a component** usually mean an authored `layout` is wrong — start at rule 0.

And when a part looks the wrong size or in the wrong place, **measure it — do not reason from the
screenshot**. A 100x100 box is Figma's default for a frame that was never given a dimension, and it
is the single most common symptom; at a glance it is indistinguishable from a part that filled
correctly. Read the node's real `x`/`y`/`width`/`height`, and check the plan's `sizing` for that
part. In this UAT a "track that did not fill" turned out to be the *indicator* at its default size,
and a "centring that did not work" turned out to be centring that worked perfectly into a parent
that clipped it.

### Resolve refusals before opening the PR

The generation report lists what the engine could not derive. Treat every entry as work to finish, not
as output to accept: **every REFUSED section — `REFUSED SIZES`, `REFUSED POSITIONS`, `REFUSED PSEUDOS`,
`REFUSED NEGATIONS`, `REFUSED DESCENDANT OVERRIDES` — must be empty before you release**, and no cell
may have an empty fill, text, stroke, or geometry binding. Resolve each refusal with the first step
that fits; work down the list in order.

1. **Use an existing token.** If the CSS wrote a literal where a token already means it (a radio dot
   at `50%`, `calc()` end-caps), change the CSS to name that token. Never mint a token for the
   contract.
2. **Hug content for sizes the browser measures at runtime.** Base UI's `--accordion-panel-height`, an
   input's `8ch` over its value: declare `{ kind: "hug" }` for that dimension in
   `packages/contracts/figma-layout.config.ts` with a reason. Hug supersedes only a refused dimension.
3. **Contract-declared runtime values, per documentation example.** A tabs indicator's extent, a
   scroll thumb's length and position: declare `runtimeValues` on each documentation example and
   place with `{ kind: "valueOf", runtimeValue }`. A missing or out-of-range declaration is a compile
   error.
4. **A real icon instead of a CSS-drawn shape.** Replace a rotated-border caret with an icon
   component (Phosphor `CaretRight`).
5. **An axis for an attribute-driven rule.** A selector like `:not([data-side])` becomes a resolved
   axis (`side`) in the contract, with `attribute`, `valueSelectors` (and `partValueSelectors` for a
   part whose selector differs from the root's, rule 1b) naming the real DOM attributes.
6. **Viewport stand-in frame plus a context axis for window-placed popups** (dialog, alert-dialog,
   drawer, toast). Declare `viewport: { placement, backdropPart, reason }` and a design-only `context`
   axis (`viewport` default, `component`). The frame's width is the existing `web/breakpoint/view`
   variable, its height hugs the popup plus padding, its padding is the CSS's named margin token, and
   the placement (`center`, an edge from the `side` axis, or corner) is declared. A popup width
   written `min(calc(100vw - var(--spacing-600)), 480px)` is computed from the CSS when the contract
   is built: the popup fills the frame, padded by the margin token, capped at 480. Trigger-anchored
   components get no frame. The frame is the viewport set's root. The bare popup is generated as its own
   component named `<Name> Popup`, and every viewport-set variant holds an
   instance of it. Code Connect maps that `<Name> Popup` component, not the viewport set; docs map the
   popup part.

Rerun `bun run figma:contract` and
`bun run figma:contract:check` after each change, and commit the regenerated
`.agents/figma-generation-contract.json` with the component. The compiler
(`packages/contracts`) is editable source that belongs to the project; change its
`contracts.config.ts` and `figma-layout.config.ts` for project settings, and treat edits to the
schema or the compiler modules as a deviation from the installed base.

### Where to read the schema, how to run the commands, how contracts land

- **Local schema first, MCP second.** Before writing or changing a contract, read the project's own
  copy: `packages/contracts/figma-contract.schema.json` (JSON Schema),
  `packages/contracts/src/generation-contract/authored-schema.ts` (the Zod source, which the project
  may have changed) and `packages/contracts/src/generation-contract/diagnostics.ts` (every refusal
  code with its message and remedy). Ask the design-system MCP server, when one is registered, only
  when the local package is missing or you need the current base schema to compare against. Never
  prefer it over the local copy.
- **Flags only, never prompts.** Run `bun packages/contracts/bin/contracts.mjs <command>` with
  explicit arguments and flags: `validate <slug>`, `check`, `compile`, `list`, `explain <slug>`,
  `new <slug> --yes`. Add `--json` to read diagnostics (code, path, message, remedy) as data. `validate`,
  `explain` and `new` take a slug and `check`, `compile` and `list` take none. Always pass the slug
  to `explain` and `new`: without one they open an interactive picker, which only appears on a
  terminal. Exit codes: 0 ok, 1 refusal or
  drift, 2 usage, 3 missing prerequisite.
- **Land by pull request; a human merges.** A contract you write or change is proposed in a pull
  request. A passing `check` is evidence for the reviewer, not acceptance, so do not push it to the
  default branch or treat it as accepted until a person merges it.

## 7 — Verify

```bash
bun run check-types                                    # or your UI package's type check
bunx @biomejs/biome check --write packages/ui/src/components/<name>
bun run build                                          # docs RSC prerender — REQUIRED for a compound, see below
bun run figma:contract:check                           # per-component Figma contract (§6)
```

**For a compound, the docs build is the only check that proves it.** The RSC-safe namespace rule (§2)
fails *at static prerender*, not at type-check: a compound whose namespace is assembled in the
`"use client"` module type-checks cleanly, then throws _"Element type is invalid… got: undefined /
object"_ when a Server Component (the docs MDX page) prerenders it. `check-types` is blind to it. So
the docs build must pass and **prerender the component's docs page** — that's the authoritative gate
for any `X.Part` dot-API.

Then load the component's docs page in the dev server and confirm the preview renders in both light
and dark themes.

**For a stateful component**, also confirm against `vercel-react-best-practices` (§2): the context
value is `useMemo`'d, exposed handlers are referentially stable, and no `useEffect` re-subscribes a
listener on a state change. A quick check: an event-listener effect's deps should be config (the
shortcut key, an enabled flag), never a handler that closes over the toggling state.

## Related

This skill covers building and changing UI components in code. Base UI composition,
customization, animation, forms, and TypeScript mechanics are in **skill-base-ui-handbook** (required
reading, §2). **Documenting the component is `skill-contribute-docs`** (its universal doc rules +
"Contributing a component" specifics — a required step here, §5, not optional). The two Vercel Labs
gates are `vercel-composition-patterns` (component-API composition, §2) and `vercel-react-best-practices`
(state/performance for stateful components, §2); install with
`bunx --bun skills@1.7.6 add https://github.com/vercel-labs/agent-skills --skill vercel-composition-patterns --skill vercel-react-best-practices`.

Related: skill-contribute-docs · skill-base-ui-handbook.
