---
name: use-design-system
description: Build with project components, tokens and guidance.
version: 1.0.0
---

# Use the design system

<!-- project-context:start -->
## Project context

Work within the fabre-DesignSystem design system.
- Read `packages/tokens` for the project's actual design tokens and installed CSS.
- Read `DESIGN.md` for portable design guidance and structured token values.
- Read `apps/docs/content/docs` for the owning conceptual and reference pages.
- Reuse components from `packages/ui` before creating a new component.
- Read `apps/docs/content/docs/about.mdx` for the maintained project tools and technologies list.
- Read the component stories in `packages/ui` for supported variants and interactions.

## Implement a change

1. Find the existing pattern and its owning documentation before editing.
2. Choose semantic roles rather than hardcoded colours, spacing or typography.
3. Preserve keyboard access, focus visibility, contrast and reduced-motion behaviour.
4. Update the implementation and its owning guidance together; do not duplicate guidance across pages.
5. Run the affected scripts declared in package.json and review the rendered result.

When shared component definitions are installed, use them for primitives, components, blocks and variants; do not invent variants or add bare primitives.

Tokens Studio owns token changes. Update the connected project, then pull; do not hand-edit downstream token exports.

Do not invent component variants, token names, integrations or commands. If a capability is absent, explain the missing prerequisite.
<!-- project-context:end -->
