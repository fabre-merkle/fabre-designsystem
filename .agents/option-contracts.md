## Option couplings & gotchas

### Figma

**Preconditions**

- Figma personal access token must have both `file_code_connect:write` and `file_content:read` scopes (`FIGMA_TOKEN`)
- The component library must be published as a Figma team library before running `bun run figma:connect:publish`
- Run `bun run figma:connect:publish` from the repo root (not from `packages/ui`)

**Couplings**

- **→ component-library:** The Figma plugin and the Figma library skill require the component library — the plugin and skills map your UI components to their Figma counterparts, and the Figma contract checks import `skill-figma-generate/lib` which ships with that library

### Tokens Studio

**Couplings**

- **→ documentation:** `tokens:pull` emits Fumadocs `@theme` CSS (`foldBaseLayer` / `emitFdTheme`) only when the Documentation node is also present; on a tokens-only project the FD-theme output is silently skipped

**Gotchas**

- **`studio` command not found after `bun install`** — Bun gates `postinstall` scripts by default; the studio-cli platform binary is not downloaded automatically  
  Fix: Run `bun run tokens:setup` once from `packages/tokens`. Do NOT add `@tokens-studio/studio-cli` to `trustedDependencies` — its postinstall fails on Vercel (EXDEV cross-device rename)

### Documentation

**Preconditions**

- Every `@/components/docs/*` MDX import must resolve to a shipped concrete module — `@focus/docs-components` guards this; run `bun run docs:check` if you add a new docs page

**Couplings**

- **→ component-library:** The component-docs bundle (`@focus/docs-components`) is only installed when both Documentation and Component Library are selected; skipping Component Library removes all 25 component reference pages

### Storybook

**Gotchas**

- **Storybook MCP context is unavailable in `skill-storybook-author`** — The Storybook MCP endpoint (`localhost:6006/mcp`) is only reachable while Storybook is running  
  Fix: Start Storybook first (`bun run storybook` in `packages/ui`) before invoking the authoring skill

- **Icon-only stories crash with unexpected `children` prop** — Stories inherit a default `children` placeholder from the template; icon components reject it  
  Fix: Clear `children` explicitly: `args: { children: undefined }`
