# Component page template

**Scope.** This template is for **component** pages only: `apps/docs/content/docs/components/<name>.mdx`,
one flat file per component. Other documentation (guides, tokens, foundations, contributing, Code to
Figma) does not use it. Start from `assets/component-page.mdx` and keep to the order below.
Pages that are not components (a styling primitive, a provider, a rule set) use
`references/utility-page.md` instead.

Copy the project's Button page (`apps/docs/content/docs/components/button.mdx`) as the worked example: a primitive with a story hero. `dialog.mdx` is the compound example
(a story hero plus a Composition section). `badge.mdx` is the example of a page with no story.

## Section order

1. **Hero.**
   - A component with a story uses `<DocsStory name="<name>" />`. It renders a live panel: a Variant
     menu (one preset per treatment), the component's props as controls, a separate "Demo" group for
     settings that only shape the example (the label, an icon placement, "show all variants"), and the
     Preview, TypeScript and CSS tabs. The source tabs come from the component registry entry
     (`apps/docs/lib/component-registry.ts`, `<name>: entry("<name>")`), so the story name and the
     registry key are the same slug.
   - A component without a story uses a static `<ComponentShowcase name="<name>">` with **one default
     instance**. Never show every variant in the hero; the playground, or the Variants section of a
     page with no story, does that.
2. **Installation.** Lead with the project's own copy: the component already ships in the project's
   component library, in the directory chosen at scaffolding, imported from
   `@workspace/ui/components/<name>`. Then one subsection, "Add or update from the design-system registry",
   with one command form, `bunx --bun shadcn@latest add @<registry>/<item>`. Use only this
   design system's own published namespace and the exact item name returned by its registry.
   Link to `/docs/registry` for configuration and project access. Never document upstream library
   credentials or internal token portals. If unpublished, state that limitation and use installed
   source instead. Keep a short caution that adding over an existing local component
   can overwrite local edits, so the diff should be reviewed first. The source is in the hero's
   TypeScript and CSS tabs, so there is no Manual copy-the-files step.
3. **Usage.** One import and the smallest representative example. If the component has a rule that is
   easy to get wrong (an icon-only button needs `aria-label`), state it in one sentence with a snippet
   here.
4. **API Reference.** `<AutoTypeTable path="<name>/<name>.tsx" name="<Name>Props" />`, then one link to
   the Base UI reference. See "API Reference rules" below.
5. **Figma contract.** `<ComponentContract slug="<name>" heading />`, last. See "Figma contract" below.

Add prose sections only for a rule the playground and the source tabs cannot show, for example how a
compound's parts compose (Dialog's Composition) or a spacing rule (Toggle Group's Grouped vs. spaced).
Put them between API Reference and the Figma contract.

## Sections that never appear

The playground and the CSS tab already show these, so a page does not repeat them:

- **Variants, Emphasis, Sizes, Icons and States sections** that describe what a preset shows ("The
  Disabled preset shows the disabled state").
- **Token tables** (height, padding, gap, type) that the CSS tab already contains.
- **Brand-surface or Figma-paint callouts** for a treatment a preset demonstrates.

Static variant demos (`<ComponentPreview variant>`) exist only on a page with no story, under a
`## Variants` heading with a `###` per axis, and a `## Sizes` section if the component has sizes.

### Variants vs. Examples

Name a section **Variants** when the component has variants (tone, mode, size, spacing). Use
**Examples** only when the component has no variants and the section shows scenarios (a dialog's modal,
non-modal and persistent behaviour). When a story covers it, there is no such section at all.

## API Reference rules

`AutoTypeTable` reads the table from the component source: prop names, types, JSDoc descriptions and
`@default` tags. `path` is relative to the component library's `components` folder; `name` is an
exported props type. For a part whose props type is not exported, also pass `type="..."` with the type
expression. A wrong or missing description is fixed in the component's JSDoc, not in the page.

- **Main table:** the props the component declares itself, plus the Base UI props that set what the
  component does (`value`, `defaultValue`, `onValueChange`, `open`, `onOpenChange`, `multiple`,
  `orientation`, `min`, `max`, ...). The native element props are hidden.
- **Collapsed "Base UI props" group:** the generic rendering and plumbing props (`className`, `render`,
  `style`, `nativeButton`, `focusableWhenDisabled`), shown with readable types such as
  `string | ((state) => string)`. The renderer builds the group; the page does not list or hide
  anything by hand.
- **No custom props** (a pure pass-through wrapper): omit the table and write one prose line saying that
  every part forwards to the matching Base UI parts, preserving every prop, event, ARIA attribute and
  the `render` API. Do not copy the primitive's props into a table.
- **A compound whose parts are the public API:** one `AutoTypeTable` per part under `###` headings.
- Never a hand-written `TypeTable` or Markdown table for a component's own props.

## Figma contract

`<ComponentContract slug="<name>" heading />` renders a **closed** "Figma contract" group on the page
with the parts, axes and slots the compiler resolved. Do not write a `## Figma contract` heading of
your own: `heading` makes the Markdown form write it. The component reads the project's compiled
`.agents/figma-generation-contract.json`, so the section follows the contract with no copy to keep in
step, and it shows nothing when there is no contract.

The **Markdown form** of the page (what agents and the MCP read) carries the full contract: parts,
axes, slots, the documented examples and the React-to-Figma notes. Those last two are not shown on the
page. When a component change touches anatomy, slots, axes, examples or geometry, update the contract
and re-run the contract compile so both forms follow.

## Adding a story

A story is a file in `apps/docs/components/docs/stories/`. Write three things:

1. **A demo component** `<name>-demo.tsx` (`"use client"`). Its props are the component's real props
   plus any demo-only settings, all optional. It renders the component inside the preview wrapper the
   other demos use.
2. **The story file** `<name>.story.tsx`:
   - `export const title = "<Name>"`.
   - `export const demoArgs = ["label", "icon"] as const` listing the arguments that are **not** props
     of the component. The controls draw them in a separate "Demo" group under the real props.
   - `export const presets` as an array of `{ variant, description, initial }`. `initial` gives every
     control a value so the panel shows the real setting. One preset per treatment worth comparing
     (each mode, a size, a state, a composition).
   - `export function snippet(props)` returning the JSX a reader would write for a preset, built with
     `jsxSnippet`. The Markdown form prints it for agents.
   - `export const story = defineStory({ displayName: "<Name>", Component: <Name>Demo, args: presets })`
     with `defineStory` from `@/lib/story`.
3. **The registration** in `apps/docs/lib/docs-stories.ts`: import the module and add it under the same
   slug the page passes to `<DocsStory name="<name>" />`.

Control types are generated from the demo component's props when the story file compiles, and the dev
server caches them. After changing a demo's props type, edit the story file and restart the dev server
so the controls refresh. Check the page in the browser: the Variant menu lists every preset, the Demo
group holds only demo-only arguments and nothing shows a required marker.

## Checklist

- Hero is a story panel or one static instance.
- Installation leads with the project's own import path, then one "Add or update from a registry" subsection with the `@<registry>/<item>` command and the overwrite caution; Usage states any easy-to-miss rule.
- API Reference is `AutoTypeTable`; no hand-written props table; one link to the Base UI reference.
- No section repeats the playground or the CSS tab.
- `<ComponentContract slug heading />` is last, with no heading of its own.
- Slug is in the components `meta.json` and the component registry; `bun run docs:check` passes.
- The production docs build prerenders the page.
