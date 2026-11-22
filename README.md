<!-- scaffold:dev-servers -->
## Dev servers

Each app runs on a **pinned port** (no proxy). `bun run dev` from the repo root
starts every app via Turbo; or run one with `cd apps/<app> && bun run dev`.

| Workspace | URL |
| --- | --- |
| `apps/docs` | http://localhost:3001 |
| `packages/ui` (Storybook) | http://localhost:6006 |

Adding an app? Pin the next free port in its `dev` script and add a row here.
<!-- /scaffold:dev-servers -->

## Design tokens — Tokens Studio

Set your Tokens Studio project id in `packages/tokens/.studio.json` (replace `PROJECT_UUID`), or let the push skill write it automatically.

See [`packages/tokens/TOKENS-STUDIO.md`](packages/tokens/TOKENS-STUDIO.md) for the full
setup: service token, project id, re-pull command, and sync workflow.

### Initial project push

Run `bun run setup:first-run`, then follow
[`.github/skills/skill-tokens-studio/SKILL.md`](.github/skills/skill-tokens-studio/SKILL.md)
to push tokens to Tokens Studio for the first time:

```
Use the Tokens Studio MCP initial-push flow — after one confirmation, create or select
the project, batch-create all token sets, create theme groups, write .studio.json, and run
CSS exports. The CLI bootstraps and exports only; it does not push tokens.
```

After the push: approve the pending changes in the Tokens Studio UI (Changes → Review → Approve).

<!-- scaffold:client -->
**Client / brand:** Fabre
<!-- /scaffold:client -->

<!-- scaffold:getting-started -->
## Getting started

Happy path — run each step in order once your project is cloned:

### 1. Push tokens to Tokens Studio

Run setup:first-run for deterministic local preparation, then follow .github/skills/skill-tokens-studio/SKILL.md to confirm a project choice and import token batches through Tokens Studio MCP. It creates themes, writes .studio.json, and runs CSS exports. Run the `skill-tokens-studio` skill, then `bun run setup:first-run`.

### 2. Generate your Figma library with the Figma plugin

In any Figma file open the Figma generation plugin from the Plugins menu, and load this project's committed .agents/figma-generation-contract.json from a local source or private GitHub repository. If automatic discovery cannot find it, enter its repository-relative path. Pick your token source, choose components, and Generate. After component changes, run bun run figma:contract, commit the artifact, then reload it in the plugin. After generation, run bun run figma:connect to generate the .figma.ts Code Connect templates.

### 4. Wire Code Connect

Generate the .figma.ts Code Connect templates for your generated Figma components from the contract and the generation manifest (bun run figma:connect), commit them, then publish to Dev Mode. The pull-request check regenerates them and fails on any difference, with no token; publishing runs on main in CI with FIGMA_ACCESS_TOKEN (Code Connect write + File content read scopes). Mappings the contract does not cover are written with the official figma-code-connect skill from the Figma plugin. Run the `bun run figma:connect`.

### 5. Set up Storybook

Run Storybook AI setup for this existing Storybook project (do not run init), follow generated instructions exactly, then verify stories. Run the `skill-storybook-author` skill, then `bun run storybook`.

### 6. View documentation in Fumadocs

Start Fumadocs and review your docs at http://localhost:3001. Run the `skill-contribute-docs` skill, then `cd apps/docs && bun run dev`.

<!-- /scaffold:getting-started -->

## Generate your Figma library (agent skill)

The `skill-figma-generate` agent skill is **already installed** at `.claude/skills/skill-figma-generate/` — there's nothing extra to install.

1. Open `.agents/connect-to-figma.md` — the full runbook (variables, the single-writer rule, generation, Code Connect).
2. Pick ONE variable writer — the agent skill or the Tokens Studio Companion plugin — never both (the runbook explains why).
3. Ask your agent: "Run the skill-figma-generate skill to generate the Figma library."

## Generate your Figma library (Figma plugin)

Generate a real Figma component library from this project's code with the **Figma plugin** — no install, no build step. The plugin is available to everyone in your Figma organisation, and the artifact it reads (`.agents/figma-generation-contract.json`) is already committed to this repo (seeded at scaffold time).

1. In any Figma file, press **⌘K** (Mac) / **Ctrl+K** (Windows) and open the plugin from your organisation's plugin list.
2. **Source** — point the plugin at this project's `.agents/figma-generation-contract.json`:
   - **Local artifact** — paste its JSON, enter a URL, or upload the `.agents/figma-generation-contract.json` file.
   - **GitHub repository** — connect GitHub and pick this repo/branch; the plugin loads the artifact from `.agents/`.
3. **Tokens** — choose your variable source in the wizard (Tokens Studio, local DTCG, or none).
4. **Components** — select the components to generate.
5. **Generate** — the plugin builds the library and binds your tokens as Figma variables.

> After changing source, CSS, a co-located `*.figma.contract.ts`, or `packages/contracts/contracts.config.ts`, run `bun run figma:contract`, commit `.agents/figma-generation-contract.json`, then reload the source. If automatic discovery cannot find the artifact, enter its repository-relative path in the plugin.
