# `@focus/mcp-claude-code`

Ships reference MCP fragments for **Claude Code** — reference configuration for the Figma MCP,
Storybook MCP, Tokens Studio MCP, and the **shadcn component MCP**.

## Figma MCP — use the official plugin instead

For Claude Code the recommended path is the **official Figma plugin** (one-liner):

```bash
claude plugin install figma@claude-plugins-official
```

The plugin ships the full Figma MCP + Code Connect skills without needing a fragment in `.mcp.json`.
**Do not** also register `figma` in `.mcp.json` — it will double-register the server id.

The `figma-mcp.claude.json` fragment (remote `https://mcp.figma.com/mcp`) is a manual fallback for
environments where the plugin can't be installed. It now points to the Figma Cloud endpoint.

## Other servers

| Server | Fragment | Notes |
|---|---|---|
| Component catalogue | `focus-mcp.claude.json` | Hosted read-only catalogue at `https://focus.merkle.design/mcp`; WorkOS employee OAuth |
| Storybook | `storybook-mcp.claude.json` | Active when `bun run storybook` is running at `:6006/mcp` |
| Tokens Studio | `tokens-studio-mcp.claude.json` | Hosted; interactive OAuth on first use (`oauth.callbackPort` pinned to 8080 — there is no `auth` key in `.mcp.json`) |
| shadcn / components | `shadcn-mcp.claude.json` | stdio `npx shadcn@latest mcp`; reads `components.json` registries |

## Install

```bash
shadcn add @focus/mcp-claude-code
```

The scaffolder merges these fragments into the project-root `.mcp.json` (`mcpServers`) for you
and then removes the merged fragments from `.agents/`. Existing server names are never overwritten,
`figma` is skipped (use the official plugin), and `storybook` is only merged when Storybook is
installed. Outside the scaffolder, merge manually or use `npx mcp-add` per server:

```bash
# shadcn MCP registration (registry credentials configured separately)
npx mcp-add --name shadcn --command npx --args "shadcn@latest mcp" --clients "claude code"
# Tokens Studio MCP (semi-interactive — mcp-add prompts for the token)
npx mcp-add --name tokens-studio --url https://api-production.tokens.studio/mcp --clients "claude code"
# Storybook MCP
npx mcp-add --name storybook --url http://localhost:6006/mcp --clients "claude code"
```

For ad-hoc remote servers: `npx add-mcp <url> -y` (neon add-mcp one-liner).

## Hosted catalogue: no local server required

After the hosted endpoint and its WorkOS resource are released, connect directly:

```bash
claude mcp add --transport http focus https://focus.merkle.design/mcp
```

Authenticate in Claude Code's `/mcp` UI with your verified Merkle or Dentsu
employee account. Do not paste a registry credential or browser-session token.
No local clone, `components.json`, Node process or registry token is needed to
connect and browse the hosted catalogue. It exposes published item metadata,
search, source and installation guidance, **not local project editing**.

The scaffolder merges `focus-mcp.claude.json` alongside the complementary local
`shadcn` registration. Existing names or an existing URL under an alias are kept;
do not register the same hosted endpoint twice. To edit/install locally, your
coding agent runs the CLI or uses the local shadcn server described below.

## Protected registry

The shadcn server remains a local stdio process, separate from the hosted catalogue `/mcp`.
It reads registry URLs and headers from the consumer's `components.json`.
Registering this process requires no OAuth; fetching protected registry items does
require a registry credential.

Configure `@focus` with `https://focus.merkle.design/r/{name}.json` and an
`Authorization` header of `Bearer ${REGISTRY_TOKEN}` in `components.json`.
Mint the credential at `https://create.merkle.design/account/tokens` and make
`REGISTRY_TOKEN` available to the process that launches the MCP server. A
project `.env.local` file alone does not prove that the editor or MCP process
loads that variable. Never place the credential itself in a committed file.

Registry requests use the existing registry-token lifecycle, independently of
browser sign-in and sign-out. Missing or invalid credentials must receive HTTP
401, not an interactive-login redirect. This local MCP registration does not
need a WorkOS OAuth resource indicator.
