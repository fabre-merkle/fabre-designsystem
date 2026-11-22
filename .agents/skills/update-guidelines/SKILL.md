---
name: update-guidelines
description: Update guidance after an agreed design change.
version: 1.0.0
---

# Update guidelines

1. Read AGENTS.md and .agents/documentation-topics.json; identify the single owning page.
2. Read the current implementation, agreed requirement and supplied reference. Treat the topic map as the ownership source; update only topics the reference supports and leave uncovered topics unchanged.
3. Preserve topic:start/topic:end markers and all unrelated authored content. Do not invent brand intent or policy.
4. Keep Foundations conceptual. Put token names, values and detailed usage in Tokens.
5. When shared component definitions are installed, use them for primitives, components, blocks and variants; do not invent variants or add bare primitives.
6. If a dependency change affects the tools list in About, ask the project owner whether its matching marked section should be updated. After agreement, edit only that section.
7. Use native Fumadocs Steps for ordered instructions, Tabs for alternatives and native copyable code blocks.
8. Link related pages rather than duplicating their guidance.
9. Keep rendered and Markdown output equivalent, run the docs production build and request human review.
10. Keep DESIGN.md concept summaries linked to the owning pages; preserve design-reference:start/design-reference:end regions and regenerate their token snapshots and structured values from project DTCG instead of hand-editing them.
