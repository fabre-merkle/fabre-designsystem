---
name: skill-base-ui-handbook
summary: Build accessible components with Base UI.
description: This skill should be consulted whenever authoring or documenting a component built on Base UI v1.9 — it distills the five Base UI handbook pages (composition, customization/styling, animation, forms, TypeScript) into durable, brand-agnostic rules with canonical links. Required reading from skill-contribute-component and skill-contribute-docs; brand-agnostic so it travels into scaffolded projects unchanged.
version: 2026.10.18
---

# Base UI Handbook (v1.9)

The standing reference for building on [Base UI](https://base-ui.com) v1.9. It is **brand-agnostic**:
no brand tokens, no repo paths — only the rules Base UI itself imposes on how you compose,
style, animate, wire forms, and type a component. Brand specifics (token governance, `@layer`
discipline, registry wiring, docs anatomy) live in the contribution + docs skills that consult this
one.

**Consult this skill when** you create or change a component, document one, or are unsure how a Base
UI primitive expects to be composed/styled/animated/typed. The five sections below mirror the five
handbook pages — read the relevant one(s), then follow the brand skill for the repo-specific layer.

The canonical pages (read for depth; this skill is the durable summary):
- https://base-ui.com/react/handbook/composition
- https://base-ui.com/react/handbook/customization
- https://base-ui.com/react/handbook/animation
- https://base-ui.com/react/handbook/forms
- https://base-ui.com/react/handbook/typescript

---

## 1 — Composition

How you wrap, re-tag, and thread refs through Base UI parts.

- **The `render` prop is the composition primitive.** Every part accepts `render` to replace the
  element it outputs — pass a React element (`render={<a />}`) to re-tag, or a **function**
  `render={(props, state) => <El {...props} />}` for full control over prop spreading and
  state-driven output. Prefer the function form in performance-sensitive or stateful renders.
- **No `forwardRef`.** Base UI threads the ref for you. A wrapper over a primitive just spreads onto
  it; a primitive-less part (a plain element you own) uses **`useRender({ render, props, ... })`**
  ([docs](https://base-ui.com/react/utils/use-render)) which merges props + ref and returns the
  element. Custom components passed to `render` must spread all received props onto a real DOM node
  and accept the ref.
- **Merge props with `mergeProps`, never by hand.** When you assemble your own props
  (`className`, `style`, `data-*`, handlers) alongside the consumer's — especially when threading a
  `render` prop — combine them with **`mergeProps`** ([docs](https://base-ui.com/react/utils/merge-props))
  so event handlers chain, `className`/`style` compose, and refs merge. `useRender` does this
  internally; reach for `mergeProps` when you build the prop object yourself.
- **Compound components are `Root` + parts sharing context.** Consumers compose the parts they need;
  state flows through context, not `renderX` props. Read context with `use()` (React 19), not
  `useContext()`.
- **Default to the primitive's element; re-tag only when semantics demand it** (e.g. a menu item
  that's really a link → `render={<a />}`).

## 2 — Customization & styling

How to restyle without breaking behaviour. (See also the brand skill's token/`@layer` rules.)

- **Style off `data-*` state attributes.** Base UI parts emit their state as data-attributes
  (`data-open`, `data-disabled`, `data-checked`, `data-highlighted`, `data-invalid`, …). Key CSS off
  these rather than toggling classes yourself. The full set is on each component's API reference.
- **`className` accepts a string or a state callback** — `className={(state) => state.open ? … : …}`
  — for the cases CSS can't express. Same for `style`.
- **Components expose CSS variables for layout-derived values** (e.g. transform origin, anchor
  width/height like `--available-height`, `--anchor-width`). Consume them in CSS rather than
  recomputing in JS.
- **Control vs. customize behaviour through props, not source edits.** Components are uncontrolled by
  default; pass `value`/`open`/`pressed` + their `on*Change` handler to control. In handlers, the
  `eventDetails` arg carries the reason + DOM event — `eventDetails.cancel()` prevents a state change,
  `event.preventBaseUIHandler()` is the escape hatch when no dedicated prop exists.
- **Author RTL-safe styles with CSS logical properties.** Use `margin-inline` / `padding-inline` /
  `inset-inline-start` / `border-start-*` and `text-align: start | end` instead of physical
  `left`/`right`/`margin-left`, and `inline-size`/`block-size` instead of `width`/`height`, so a
  component mirrors automatically in right-to-left locales. Base UI components honour the reading
  direction from **`DirectionProvider`** (`direction="rtl"`, set once near the app root) — but that
  only flips *Base UI's* behaviour (positioning, keyboard nav); logical properties are what make
  *your* CSS follow suit. There's no separate "RTL mode" to maintain: author logical, set the
  provider, done.
- **Popups take a surface level.** Style an overlay's `Popup` from `--color-surface-level-N` and
  `--shadow-level-M`, where N comes from the level context (substrate + offset: popovers +2, dialogs +4) and M is the component's own shadow default, not derived from N. The edge is `--color-surface-border-<N+1>`. Context
  passes through portals, so a popup keeps the level of the tree it was declared in. Tooltips are the
  exception: inverted fill, no level. Controls built on a primitive take their height, text and
  touch target from the `control.*` tokens; press scale is `0.96` under `prefers-reduced-motion:
  no-preference` only, and hover sits in `@media (hover: hover)`.
- **Never fork Base UI's source or re-author a primitive's structure** — it breaks adopting upstream
  fixes. Mirror its pattern in your wrapper instead.

## 3 — Animation

- **Transition off the lifecycle data-attributes:** `[data-open]` / `[data-closed]` (current state),
  `[data-starting-style]` (initial frame to transition *from* on enter), `[data-ending-style]`
  (frame to transition *to* on exit). Base UI keeps the element mounted long enough for the exit
  transition to run.
- **Prefer CSS transitions** (cancel cleanly mid-flight) over keyframe animations for enter/exit;
  use `@keyframes` only for sequences that need them.
- **JS animation (Motion):** compose via `render={<motion.div … />}`. Base UI waits for an **opacity**
  animation before unmounting — if you don't animate opacity, set a near-1 value (`opacity: 0.9999`)
  so it's detectable; or use `keepMounted` + `<AnimatePresence>`, or `actionsRef` for manual unmount.
- **Always pair motion with `@media (prefers-reduced-motion: reduce)`** that neutralises the
  transition/animation. Enumerate transition properties — never `transition: all`. Put hover-driven
  motion inside `@media (hover: hover)`.

## 4 — Forms

The load-bearing section for Field / Fieldset / Form work.

- **`Field.Root`** wraps a single control and owns its validation + a11y wiring. Pass **`name`** to
  include the control's value in form submission. It exposes `data-valid`/`data-invalid`/`data-dirty`/
  `data-touched` for styling.
  - **`Field.Label`** — associates an accessible label (use for Input, Checkbox, Radio, Switch).
  - **`Field.Control`** — renders the actual input; this is where you compose your styled control via
    `render` (see how a textarea/input wrapper threads `Field.Control` + `mergeProps`).
  - **`Field.Description`** — hint text wired via `aria-describedby`.
  - **`Field.Error`** — validation message; `match` prop selects which validity failure it shows.
  - **`Field.Validity`** — render-prop access to the live validity state.
- **`Fieldset.Root` + `Fieldset.Legend`** group related fields (radio/checkbox groups, multi-thumb
  sliders) with an accessible legend.
- **`Form`** orchestrates submission + cross-field validation. `onSubmit`/`onFormSubmit` receive the
  values; the **`errors`** prop injects server-side errors (cleared when the field changes).
- **Validation pipeline:** native constraints (`required`, `minLength`, `pattern`, `step`) run first,
  then a custom **`validate`** function (sync or async). `validationMode` = `"onSubmit"` (default) |
  `"onBlur"` | `"onChange"`; `validationDebounceTime` debounces async checks.
- **Accessibility:** prefer a visible `Field.Label` (or `Select.Label`/`Combobox.Label` for
  trigger-based controls); fall back to `aria-label` on the control only when no visible label
  exists. Give each multi-thumb `Slider.Thumb` its own `aria-label`.
- **Icon-only parts follow shadcn's Base UI pattern.** The icon is a child. Put it
  first or last: the control infers the side, so a bare icon component works, and
  `data-icon="inline-start"` or `"inline-end"` is optional and wins where present; icon-only is a size
  (`size="icon"`, `"icon-xs"`, `"icon-sm"`, `"icon-lg"`), not a boolean prop; and the control needs an
  accessible name (`aria-label`, `aria-labelledby` or visually hidden text). Throw in development
  when an icon-only control has none. Do not add `startIcon`, `endIcon`, `iconOnly` or `icon` props.

## 5 — TypeScript

- **Extend the primitive's props; never restate them.** A wrapper's props type =
  `React.ComponentProps<typeof XPrimitive> & Partial<{ …additive axes… }>`, so every Base UI prop,
  event, ARIA attribute, and the polymorphic `render` prop stays available.
- **Give every design variant axis prop an explicit default.** A finite string-literal prop such as `size`, `variant`, `mode`, `tone` or `orientation` declares its default in the component's parameters (`size = "md"`, or `const resolved = size ?? group?.size ?? "md"` when inherited), never `undefined`, so the Figma contract compiler can read it (`axis-default-missing` otherwise). Exceptions: controlled/uncontrolled props (`value`, `checked`, `open`), booleans and optional content props (`icon`, `children`).

- **Base UI namespaces its types** under each part: `X.Root.Props`, `X.Root.State`,
  `X.Root.ChangeEventDetails`, `X.Root.ChangeEventReason`. Reference those when you need the exact
  shape (e.g. typing an `onValueChange` handler) rather than re-deriving.
- **Typing a `render` function:** its signature is `(props, state) => ReactElement`; for a
  primitive-less part use **`useRender.ComponentProps<Tag>`** to type the extended React props your
  part accepts.
- **Export your wrapper's `Props` type** from the component module (e.g. `export type ButtonProps`)
  so consumers and the docs `TypeTable` can reference it.

---

## Upgrading to a new Base UI release

Steps to safely adopt a new Base UI version repo-wide.

1. **Read the changelog** at https://base-ui.com/changelog. Classify the release: patch (bug/perf only), minor (new stable APIs), major (breaking). A patch skips wrapper review; a minor may add primitives; a major needs a full wrapper audit.
2. **Bump `@base-ui/react`** in all consuming `package.json` files to the new caret range. Run the package manager install.
3. **Re-test thin wrappers.** Run typecheck and lint. Rewrite a wrapper only when it explicitly relied on changed behaviour — 1.x minor releases have not required wrapper rewrites.
4. **Add new primitives.** If the release promotes a preview component to stable, check whether it was previously vendored or absent and author the wrapper + registry item.
5. **Re-vendor dependents.** See "Consuming packages" below.
6. **Re-publish registry.** Run the registry build to bake the new resolved version into `public/r/*.json`.

### v1.6 — what changed

- **OTP Field** promoted to stable. Import from `@base-ui/react/otp-field`: `OTPField.Root` + `OTPField.Input`. The UI package's wrapper is `OTPField` in `packages/ui/src/components/otp-field/`.
- Bug and performance fixes throughout; no API breaks; no wrapper rewrites required.

### v1.9 — what changed

- **Unmount on close** for Autocomplete, Combobox and Select is no longer tied to `actionsRef`; call `eventDetails.preventUnmountOnClose()` in `onOpenChange` to opt out.
- `onItemHighlighted` (Autocomplete, Combobox) now receives the originating event.
- Menu filtering (`Menu.FilterProvider`, `Menu.Input`) is preview; not adopted in wrappers.
- Otherwise fixes and performance work; no wrapper rewrites required.

### Consuming packages

Bump `@base-ui/react` in every `package.json` that depends on it: the UI package, the docs app, and any app that imports it directly. After bumping, run `bun install` from the repo root, then:

```bash
bun run check-types
```

---

## Related

Consumed by **skill-contribute-component** (build mechanics) and **skill-contribute-docs**
(documentation), which add the project-specific layer on top. Base UI's four author utilities —
`mergeProps`, `useRender`, `DirectionProvider`, `CSPProvider` — ship with `@base-ui/react` (already a
dependency of every component); you never install them separately. See the docs site's "Base UI
Utilities" page for the consumer-facing summary.
