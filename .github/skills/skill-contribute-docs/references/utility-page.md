# Utility and concept page template

**Scope.** This template is for pages in the docs `components` section that are **not components**: a
styling primitive, a runtime provider, a rule set that applies to many components, or a pointer to
upstream utilities. They sit in the `---Utilities---` group of the section's `meta.json`. A placeable
component uses `references/component-page.md` instead. Start from `assets/utility-page.mdx`.

The shape follows shadcn's utility pages: a short intro, Installation, Usage, then concept sections
for what a snippet can't carry. It adds Overview, When to use, API Reference and Related.

## Section order

1. **Overview.** One paragraph on what it is and what it isn't. When it could be mistaken for a
   component, add a `<Callout type="info" title="Not a component">`. The frontmatter `description`
   renders under the H1, so don't repeat it.
2. **When to use.** Optional. Include it only when there is a decision rule. Leave it out when the
   answer is always "use it".
3. **Installation.**
   - With a registry item: lead with the project's own copy (it already ships in the component
     library, imported from `@workspace/ui/components/<name>`), then one "Add or update from a
     registry" subsection with the same command form and overwrite caution as a component page.
   - Without one: a single line, "Nothing to install", saying where it already comes from.
     Also delete the starter's `Name` import and its `Name` Usage example, which only fit a registry
     item; left in, the page does not build.
4. **Usage.** The smallest example, then the one easy-to-miss rule in a sentence. Add a live demo only
   where it shows that rule; a demo of the obvious case is noise.
5. **API Reference.** `<AutoTypeTable path="<name>/<name>.tsx" name="<Name>Props" />`, then a prose
   table for extra exports (hooks, constants, context) the props type doesn't cover. Omit the section
   when there is no API.
6. **Concept sections.** Only for rules a table or snippet can't carry. Group several rules under one
   `## Rules` heading with `###` children. One rule is one section.
7. **Related.** Links to the guide page that owns the concept and to sibling utilities. Put the
   upstream link here; these pages have no `primitive:` frontmatter (it expects a Base UI URL).

## How it differs from a component page

- **No `DocsStory` hero** and no `ComponentShowcase` hero. The page opens with Overview, not a panel.
- **No `ComponentContract`.** There is no design component to describe.
- **No Variants, Sizes, Emphasis, Icons, States or Examples sections.**
- **A live demo only where it shows the rule.** If the rule fits a snippet, use the snippet.
- **No token tables a guide already holds.** Link the guide and keep one source of truth per fact.

## Registry and navigation

- **Registry entry.** A page that shows source needs `<name>: entry("<name>")` in
  `lib/component-registry.ts` (add `files` by hand when the item has more than `<name>.tsx` and
  `<name>.css`).
- **`meta.json`.** Add the slug to the `---Utilities---` group of the components `meta.json`.
- **Description.** A page with no registry item needs its own frontmatter `description`.
- Run `bun run docs:check` to confirm every `@/components/docs/*` import resolves.

## Checklist

- Overview first, with a "not a component" callout where it could be mistaken for one.
- Installation is the local copy plus the registry subsection, or one "nothing to install" line.
- API Reference is `AutoTypeTable` plus a prose table for the rest, or omitted.
- No hero, contract, variants or sizes; demos only where they show a rule.
- Related links the guide and the sibling utilities.
- Slug is in the `---Utilities---` group; `bun run docs:check` passes.
- The production docs build prerenders the page.
