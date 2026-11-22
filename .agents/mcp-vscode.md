# `@focus/mcp-vscode`

Ships reference MCP fragments for **VS Code / GitHub Copilot** — configuration for the Figma MCP,
Storybook MCP, Tokens Studio MCP, and the **shadcn component MCP**.

## Figma MCP — VS Code fragment (remote endpoint)

VS Code has no plugin one-liner for the Figma MCP, so the fragment is the recommended path.
The updated fragment points to the **Figma Cloud endpoint** (`https://mcp.figma.com/mcp`):

The scaffolder merges `figma-mcp.vscode.json` → `servers.figma` into `.vscode/mcp.json`.

> **Claude Code / Cursor / Gemini:** install the official Figma plugin instead
> (`claude plugin install figma@claude-plugins-official` / `/add-plugin figma`).
> Never double-register the `figma` server id.

## Other servers

| Server | Fragment | Notes |
|---|---|---|
| Component catalogue | `focus-mcp.vscode.json` | Hosted read-only catalogue at `https://focus.merkle.design/mcp`; WorkOS employee OAuth |
| Storybook | `storybook-mcp.vscode.json` | Active when `bun run storybook` is running at `:6006/mcp` |
| Tokens Studio | `tokens-studio-mcp.vscode.json` | Hosted; semi-interactive auth on first use |
| shadcn / components | `shadcn-mcp.vscode.json` | stdio `npx shadcn@latest mcp`; reads `components.json` registries |

## Install

```bash
shadcn add @focus/mcp-vscode
```

The scaffolder merges these fragments into `.vscode/mcp.json` (`servers`) for you and then
removes the merged fragments from `.agents/`. Existing server names are never overwritten, and
`storybook` is only merged when Storybook is installed. Outside the scaffolder, merge manually or
use `npx mcp-add` per server:

```bash
# shadcn MCP registration (registry credentials configured separately)
npx mcp-add --name shadcn --command npx --args "shadcn@latest mcp" --clients "vscode"
# Tokens Studio MCP (semi-interactive)
npx mcp-add --name tokens-studio --url https://api-production.tokens.studio/mcp --clients "vscode"
# Storybook MCP
npx mcp-add --name storybook --url http://localhost:6006/mcp --clients "vscode"
```

## Protected registry

After the hosted endpoint and its WorkOS resource are released, run **MCP: Add
Server** in VS Code, choose **HTTP**, enter `https://focus.merkle.design/mcp`,
and name it `focus`. Complete the OAuth prompt with your verified Merkle or
Dentsu employee account. No local server, clone, registry token or
`components.json` is needed to connect and browse the catalogue. Do not paste
`msc_`/`mrt_` credentials or browser-session tokens into the hosted connection.

The scaffolder merges `focus-mcp.vscode.json` alongside the complementary local
`shadcn` server. Existing server names or URLs under aliases are preserved to
avoid duplicate registration. Hosted tools browse published items and source;
they cannot edit your project. Install via your local coding agent/CLI or keep
the local shadcn server below.

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
