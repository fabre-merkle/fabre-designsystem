---
name: skill-contribute-docs
summary: Write and maintain design-system documentation.
description: This skill should be used when authoring or documenting a UI component, or making any change to the project docs site — documenting a component, writing guidelines/conceptual pages, or curating resource links. It defines universal requirements for every doc contribution plus per-kind specifics (the component section is filled out). Invoked by skill-contribute-component after any component create/change, and usable standalone. Component docs stay in sync with the component and its Figma generation contract. Brand-agnostic, so it travels into scaffolded projects unchanged.
version: 2026.11.11.1
---

# Contribute Docs

This skill governs **any documentation contribution to the project's docs site** (`apps/docs`,
Fumadocs MDX under `apps/docs/content/docs/`). This is a **white-label** design system, so the rules here
are brand-neutral. It has two layers:

1. **Universal documentation requirements** — apply to *every* doc contribution, no matter the kind.
2. **Per-kind specifics** — additional rules for the particular thing you're documenting.
   **Contributing a component** is filled out below; the other kinds (guidelines/concepts, resource
   links) are placeholders to be completed as those workflows are formalised.

Use this skill standalone for any docs-only edit, or as the handoff target from
`skill-contribute-component` when a component is created or changed. It does not change non-doc source; if
a doc edit reveals the underlying thing is wrong, escalate to the skill that owns it
(`skill-contribute-component` for components).

For the **upstream Base UI behaviour** a page describes — the `render`/composition API,
validity/animation states, and especially **form** wiring — defer to **`skill-base-ui-handbook`**
rather than re-deriving it; a form-control page (Field, Fieldset, Form, Input, …) should also
cross-link the conceptual forms guide.

---

## Universal documentation requirements

Apply these to **every** documentation contribution, regardless of kind.

- **Human-readable titles.** The frontmatter `title` uses spaces, not code casing —
  `title: Surface Provider`, not `SurfaceProvider`. Inline code references still use the exact symbol
  in backticks (`` `SurfaceProvider` ``). Where a page mirrors a registry item, keep the doc `title`
  and the registry item `title` identical.
- **Description renders under the H1.** The frontmatter `description` is shown beneath the title by
  Fumadocs — don't repeat it as the first body paragraph.
- **Make sections navigable.** Use authored `##`/`###` headings for meaningful sections, including
  `## Interactive example` before a story and `## Figma contract` before its contract widget.
  A bold label or a table row does not populate Fumadocs' contents list. Generated token sections
  must keep their rendered heading IDs and page contents entries in step.
- **Demonstrate the actual system.** Interactive token and foundation examples use installed
  project components and current token values, not lookalike controls or placeholder rectangles.
  Show recognisable tasks, provide useful initial comparison states, and respect reduced motion.
  Token-only docs keep their component-independent examples; do not make a UI library mandatory.
- **Register it in the sidebar.** Add the page slug to the relevant `meta.json` `pages` array (the
  sidebar reads each page's `title` from frontmatter, so the label updates automatically).
- **Keep docs in sync with their source of truth.** Documentation must not drift from what it
  describes. When the underlying thing changes, the doc changes in the same contribution.
- **Keep one owning page per topic.** Read `.agents/documentation-topics.json` when present,
  preserve `topic:start` / `topic:end` markers, and link from other pages rather than duplicating
  guidance. Foundations introduce concepts and intent; Tokens owns token names, resolved values
  and concrete references. Preserve useful baseline guidance until a supported replacement exists.
- **Use the project's real guidance.** `AGENTS.md` is the lean entry point, installed skills live
  under `.agents/skills`, and any `DESIGN.md` reads the same project token data. The Working with AI
  page owns their workflow. Do not claim a tool is authenticated merely because its MCP configuration
  is installed.
- **For component docs, check Figma-contract sync too.** Every visual component has a Figma generation
  contract (`<name>.figma.contract.ts` beside the component), required whether or not the project chose
  a Figma option. A component change that touches anatomy, slots, axes, examples, or geometry also
  needs the matching contract update. If the contract is missing or stale, hand back to
  `skill-contribute-component` before marking docs complete. A region that accepts arbitrary children is
  a native slot (`defaultContent: "anatomy"`, plus `stretch` when the CSS fills) whose default content is
  the page's documented example; do not describe it as fixed layout. Where the page states something the contract
  changed, update that statement in the same contribution.
- **Use the globally-registered MDX components; never paste large source blocks.** Components like
  `Tabs`/`Tab`, `Steps`/`Step`, `Cards`/`Card`, `Accordions`/`Accordion`, `AutoTypeTable`, `DocsStory`, `ComponentContract`, and the component-doc widgets are registered in
  `apps/docs/mdx-components.tsx` — no imports needed. Read source from disk via the provided widgets
  rather than pasting it into MDX (it bloats the bundle and goes stale). For link grids (a landing
  page, a "Related" row) use the native `Cards`/`Card` with `title`, `href` and `description`; do
  not build a custom card component.
- **Internal links resolve.** Use real routes (e.g. `/docs/components/button`) — no dangling or
  guessed paths.
- **Document this design system, not its scaffold provider.** Install commands, agent prompts and
  credential guidance use only the project's own published registry namespace. Never expose upstream
  registry setup, internal account portals or token-minting instructions. Link to `/docs/registry`
  for project access. If publication or item availability is unconfirmed, say so; do not invent
  an endpoint, item name or alternative upstream install.
- **Verify before done — with the production build, not just the dev server.** MDX bodies prerender
  as React Server Components, so an RSC-incompatible page (a compound namespace rendered raw, a
  render-prop child, a shadowed global component — see the component section) **compiles and runs in
  dev but fails only at static prerender**, and `check-types` is blind to it. Run
  `cd apps/docs && bun run build` and confirm the page prerenders — that's the authoritative gate.
  Then check it returns 200 with no MDX compile error, renders in light and dark, and all links
  resolve. The in-tool screenshotter is unreliable on deep-scrolled docs pages — verify by fetching
  the page and checking the rendered HTML / computed styles rather than relying on a screenshot.

---

## Contributing a component

The filled-out specifics for documenting a UI component. Every component has an MDX page at
`apps/docs/content/docs/components/<name>.mdx` (flat, one file per component), rendered with a live
preview. (Applies on top of the universal requirements above.) For the upstream Base UI behaviour a
page describes — the `render`/composition API, validity/animation states, and especially **form**
wiring — defer to **`skill-base-ui-handbook`** rather than re-deriving it; a form-control page (Field,
Fieldset, Form, Input, …) should also cross-link the conceptual forms guide.

### Docs-completeness rule — ship the parts module, not a shim

Every component page that uses live previews **must ship a concrete `components/docs/<name>-parts.tsx`** (or `components/docs/demos/<name>-demo.tsx` for render-prop demos) alongside the MDX. There is no shared-parts file — each component's export file is discrete. Specifically:

- **Do NOT create a `parts-shared.tsx`** or any shared re-export aggregator. Every MDX page imports from its own `<name>-parts.tsx`; that file is the concrete module the script verifies.
- The parts file re-exports the compound namespace parts as named exports (see `accordion-parts.tsx` for the pattern), marked `"use client"` if the component has interactive state.
- After adding a page + parts file, run `bun run docs:check` to confirm all `@/components/docs/*` imports resolve. This is the acceptance gate for docs completeness.

### Page anatomy

For a component page, load `references/component-page.md` and start from `assets/component-page.mdx`.
Other pages don't use this template.

### The live-preview pipeline

- **`DocsStory name="<name>"`** is the hero of a component with a story: the live panel plus the
  source tabs. **`ComponentShowcase name="<name>"`** is the hero of a component without one (one
  default instance). Both take their source tabs from **`apps/docs/lib/component-registry.ts`** — the
  slug **must** have an entry there (`<name>: entry("<name>")`), which points at `<name>.tsx` +
  `<name>.css`. No entry → no source tabs. Each tab renders in Fumadocs' native code block, so it
  looks like any other fence.
- **`<include cwd lang="tsx" meta='title="<name>.tsx"'>../../packages/ui/src/components/<name>/<name>.tsx</include>`**
  is the native Fumadocs include. It reads the file at build time and renders it as a titled code
  block. Use it (typically inside Installation → Manual) instead of pasting source. `cwd` resolves the
  path from the docs app root, so it does not depend on how deep the page sits; set `lang` to `tsx`
  or `css`. A wrong path fails the build. Adjust the path if the component library lives elsewhere.
- **`ComponentPreview variant`** is the denser wrapper for variant rows on a page with no story.
- **`AutoTypeTable` is the API Reference, always generated from source** — never a Markdown table and
  never a hand-written `TypeTable`. `<AutoTypeTable path="badge/badge.tsx" name="BadgeProps" />` reads
  the props, types, JSDoc descriptions and `@default` tags from the component. A missing description is
  fixed in the component's JSDoc, not in the page. The renderer shows the component's own and
  behavioural props, and collapses the generic Base UI props. The pass-through, compound and
  unexported-type cases are in `references/component-page.md`.
- **`ComponentContract slug="<name>"`** renders the closed "Figma contract" group from the
  project's compiled contract. Precede it with `## Figma contract` for in-page navigation;
  omit the widget's `heading` prop so its Markdown form does not duplicate that heading.

### Render-prop demos can't be authored inline

MDX bodies compile as React Server Components. A render-prop child or an inline handler that closes
over state **fails the static prerender** ("Functions cannot be passed directly to Client
Components"). Hoist such examples into a `"use client"` demo file at
`apps/docs/components/docs/demos/<name>-demo.tsx`, export a named `<Component><Scenario>Demo`
function, and import it into the MDX.

### Compound parts: render the dot-API directly — never a flat-re-export shim

A compound (Accordion, Tabs, Meter, Dialog, …) ships its namespace assembled in a non-`"use client"`
`index.ts`, so it is **RSC-safe**: import the namespace from `@workspace/ui/components/<name>` and render the dot-API
(`<Accordion.Root>`, `<Meter.Track>`) **directly in the MDX body**.

Do **not** create a flat-re-export shim (`export const AccordionRoot = Accordion.Root`). That pattern
existed only to work around the old namespace-from-`"use client"` gotcha and is unnecessary now that
the components are RSC-safe — every component page uses the dot-API directly. The only re-export files
worth keeping are ones that *also* define a live **demo component** (the render-prop hoist above); a
*pure* re-export shim is never the answer.

### Name collisions with the global MDX components

Fumadocs registers `Tabs`/`Tab`, `Steps`/`Step`, `Accordion`/`Accordions`, `Card`/`Cards`, `Callout`,
… as **global** MDX components (used with no import). When the component you're documenting shares a
name with one of those — most commonly **`Tabs`**, since every page's Installation block uses the
global `<Tabs items={…}>` — importing the UI namespace at the top of the page **shadows the
global**, and the install `<Tabs>` then tries to render the UI namespace object → _"Element type
is invalid… got: object."_ Fix: **alias the UI import**, and use the alias for the live example
only:

```mdx
import { Tabs as UiTabs } from "@workspace/ui/components/tabs";

<ComponentShowcase name="tabs">
  <UiTabs.Root> … </UiTabs.Root>   {/* live example → the alias */}
</ComponentShowcase>

<Tabs items={["CLI", "Manual"]}>         {/* the global, unshadowed */}
```

Keep the **copyable** Usage / Manual code sample showing the real, unaliased API
(`import { Tabs }` / `<Tabs.Root>`) — that's what a consumer pastes; only the page's live render needs
the alias.

### Decorative preview blocks can't hold focusable controls

A preview wrapper marked `aria-hidden="true"` (a faux input, an example prompt, a swatch strip) must
not contain a focusable control — `aria-hidden` + a tab stop is a hidden, unreachable-by-AT focus
target. Use a non-interactive element, or pass `tabIndex={-1}` to the control.

### Inline components: keep children on one line

MDX wraps a JSX element's children in a `<p>` when they span multiple lines. For an **inline**
component (Badge, MetricBadge, a chip) that turns the visible content into a block paragraph —
Fumadocs prose margins then inflate the rendered size and break vertical rhythm (a MetricBadge
ballooned from 17px to ~65px this way, and it isn't caught by types or lint). Keep inline-component
children on a **single line**:

```mdx
{/* ✅ children stay inline */}
<MetricBadge direction="up" sentiment="positive">+12.4%</MetricBadge>

{/* ❌ multi-line → children wrapped in <p>, the badge inflates */}
<MetricBadge direction="up" sentiment="positive">
  +12.4%
</MetricBadge>
```

Block components (Card, Toolbar) aren't affected — the rule is for inline ones. Belt-and-braces: give
an inline component an explicit `line-height` in its CSS so it sizes predictably regardless of host
context.

### Icons in demos use Phosphor

The design system's icon library is **Phosphor** (`@phosphor-icons/react`, a direct `apps/docs` dependency).
Import demo icons from **`@phosphor-icons/react/dist/ssr`** — the SSR entry, since MDX bodies are
server components — the way every docs widget already does. Never reach for `lucide-react` (it only
resolves transitively via Fumadocs, so it's a fragile import) or hand-rolled inline SVGs.

```mdx
import { House, MagnifyingGlass, Gear } from "@phosphor-icons/react/dist/ssr";
```

### Keeping a component doc in sync

| Component change | Doc edit |
|---|---|
| New **variant** / **mode** | Add a preset to the component's story (or, with no story, a `<ComponentPreview variant>`). |
| New / changed **prop** | Update the prop's JSDoc and `@default` tag in the component; the API Reference `<AutoTypeTable>` reads them. |
| New / changed **part** (compound) | Update the component's contract, then recompile it: the page's Figma contract group lists the parts, axes and slots from it. |
| **Typography / token** change on a part | Reflect it wherever the page states it in prose; the contract group follows the compiled contract. |
| Any component create/change | Confirm the component's `<name>.figma.contract.ts` is updated (a contract is always required), or hand back to `skill-contribute-component`. Update any page text the contract change invalidates. |
| **Rename** | Update frontmatter `title` (drives sidebar + H1) and the import path in Installation and Usage. |
| New component | Create the page from `assets/component-page.mdx`; add a story if it has variants; add the slug to `component-registry.ts` **and** the components `meta.json`; ship `components/docs/<name>-parts.tsx`; run `bun run docs:check`. |

Component-specific note: this project owns its component library. Installation leads with the local
copy (it already ships in the library, in the directory chosen at scaffolding), imported from
`@workspace/ui/components/<name>`. Adding or updating from a registry has one command form,
`bunx --bun shadcn@latest add @<registry>/<item>`, where `<registry>` is this design system's
own published namespace, not whichever registry appears first in `components.json`.
Use the exact item name returned by that registry's discovery tools. Link to `/docs/registry`
for publication and access details. If it is not published, use the installed source and state the
limitation instead of substituting an upstream library. Adding over an existing local component
can overwrite local edits, so review the diff first.

---

## Other documentation contributions

> **Placeholder — to be completed.** The sections below will capture the per-kind specifics for
> non-component docs. Until they're filled in, apply the **Universal documentation requirements** above
> and mirror the closest existing page of the same kind.

### Utility and concept pages

A page in the docs `components` section that is not a component (a styling primitive, a provider, a
rule set that applies to many components) sits in the `---Utilities---` group and uses
`references/utility-page.md` (start from `assets/utility-page.mdx`), not the component template.

### Guidelines & conceptual docs

*TBD.* (For pages like Accessibility, Composability, Customization, Setup, Forms — narrative guidance
rather than a registry item. Will cover: where they live, IA/sidebar placement, how they reference
tokens/components, and what "in sync" means for guidance that isn't generated from a source artifact.)

### Linking external & resource pages

*TBD.* (For curating links to other resources — design references, upstream docs, Figma, related
tools. Will cover: link hygiene, attribution, safe-URL handling, and where resource links belong in
the IA.)

---

## Contracts

When a page documents a component's Figma contract, or a docs change depends on what a contract
field or refusal means:

- **Local schema first, MCP second.** Read `packages/contracts/figma-contract.schema.json`,
  `packages/contracts/src/generation-contract/authored-schema.ts` and
  `packages/contracts/src/generation-contract/diagnostics.ts` before documenting from memory. Ask the design-system MCP server, when one is registered,
  only if the local package is missing or you need the current base schema to compare against.
- **Flags only, never prompts.** Run `bun packages/contracts/bin/contracts.mjs <command>` with
  explicit arguments and `--json` or `--yes`; never rely on an interactive picker.
- **Land by pull request, and a human merges.** A contract an agent writes or changes is proposed in
  a PR; a passing `check` is not acceptance.

## Related

This skill covers contributing documentation to the project docs site. Building or changing a component
itself is **skill-contribute-component** (which hands off here after any component create/change). For the
upstream Base UI behaviour a page describes — composition, customization, animation, forms, TypeScript
— defer to **skill-base-ui-handbook**; the render-prop-in-docs hoist rule above is the docs-side echo
of that handbook's composition guidance.

Related: skill-contribute-component · skill-base-ui-handbook.
