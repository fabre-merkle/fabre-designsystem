# Connect this project to Figma — end-to-end runbook

The ordered path from your code components to a themed, Code-Connected Figma library. An agent (or you)
runs this once per project; later token changes flow through the same steps. Each step names the one
thing that most commonly goes wrong.

**Gate order — do not skip ahead.** The steps must run in this sequence:
0. Auth → 1. Components → 2. DTCG + CSS → 3. Figma file + MCP → 4. Generate → 5. Code Connect

The skill referenced here (`@<dsname>/skill-figma-generate`) is installed in `.claude/skills/`. Ask your agent to "follow connect-to-figma" and it will walk these in
order, stopping on any failed precheck.

## The one rule that prevents pain: single variable writer

Figma variables must have **exactly one writer** — one tool that owns creating and updating them.
Two writers on the same file fork the variable set: the second doesn't recognise the first's variables,
creates **duplicates**, and your component bindings end up pointing at the orphaned copy.

**The default here is Pattern A: your project owns the variables; Tokens Studio is the token
editor/source, not the Figma writer.** Concretely, `@<dsname>/skill-figma-generate --bootstrap-variables`
materialises the variables from this project's DTCG during generation; the **Companion by Tokens
Studio** plugin's *Pull from Studio* is **not used** for this file. You still edit tokens in Tokens
Studio and pull the DTCG — but the *write to Figma* is owned by your project's generation step, so it's deterministic and
re-runnable with no plugin clicking.

> Why not the plugin-as-writer? You can't have both. If you'd rather Tokens Studio's plugin own the
> variables, that's a valid alternative — but then DON'T `--bootstrap-variables`; let the plugin be the
> sole writer from the start (the manual fallback at the end of Step 2). Pick one at Step 2 and stick
> with it.

## Step 0 — Auth (Tokens Studio access)

The DTCG pull (`bun run tokens:pull`) needs to authenticate with Tokens Studio. Two modes — pick the one
that matches your setup, and confirm it works before proceeding:

- **Service token (CI + non-interactive):** set `TOKENS_STUDIO_TOKEN_FOCUS_TEMPLATE` (a project-scoped
  service token — see `packages/tokens/README.md`). Then run `bun run tokens:pull:ci`. Use this on CI
  or in any environment where interactive device-code isn't possible.
- **OIDC device-code (interactive default):** run `studio auth login` once (opens a browser) — creates a
  ~24h keychain token. Then run `bun run tokens:pull`. Use this on a developer machine.

> **No token yet?** Create a project-scoped service token in the Tokens Studio dashboard → Project
> settings → Service tokens. You only need it for the pull; it's never stored in the repo.

## Step 1 — Components exist

`@<dsname>/ui` is present (it was scaffolded). Nothing to do unless you renamed or removed it; the
generate skill's preflight checks this and can re-install from the registry.

## Step 2 — DTCG pulled + CSS exported

The tokens live in Tokens Studio as your editing surface, but the project's generation step writes the Figma variables:

1. Pull the DTCG: `bun run tokens:pull` (interactive) or `bun run tokens:pull:ci` (service token).
   This produces `packages/tokens/dtcg/` — the source for the Pattern A variable bootstrap.
2. Export resolved CSS: `bun run tokens:export`. This produces `packages/tokens/css/` — the cascade
   your app imports. **Both steps must complete before proceeding to Step 3.**
3. On later token changes, re-run both: pull the DTCG → export CSS → re-run generation with
   `--bootstrap-variables`. Variables update in place; component bindings survive across runs.

> **Manual fallback (plugin-as-writer — the Companion plugin).** If you'd rather Tokens Studio own the
> Figma variables: import the whole folder **including `$themes.json`** into a Studio project (skipping
> it yields a flat, modeless variable set). Then, in Figma, install **"Companion by Tokens Studio"**,
> authenticate, select that (variable-based) project, paste your **Figma file URL** and **Save**, then
> use **Sync with Studio → Pull from Studio** to write the variables — it creates them, and updates in
> place on later pulls (no duplicates). Set the collection's **Sync settings → "Studio is source of
> truth"** so Figma-side edits never overwrite. Do **not** pass `--bootstrap-variables` — the Companion
> plugin is then the sole writer; re-pull from it on every change.

## Step 3 — Figma file created + Figma desktop open + MCP active

Before generation, the skill creates (or locates) the Figma file:

1. The skill calls `whoami` and asks which team or project to use. Confirm or override in
   `.agents/figma.config.json → figma.projectId` / `figma.planKey`. The default landing-zone team
   project is the recommended choice for first runs. The `fileKey` is recorded in `.agents/figma.json`.
2. **Open Figma desktop** (not the browser) and confirm the Figma MCP is active. The MCP config is
   is registered in `.vscode/mcp.json` (VS Code, merged by the scaffold) or via the official Figma
   plugin (Claude Code: `claude plugin install figma@claude-plugins-official`). If a probe shows the MCP tools are missing, stop here: confirm Figma desktop is open and
   the MCP extension / plugin is enabled before proceeding.

## Step 4 — Generate the Figma component library

**Scope selection (interactive, first run only).** Before generating, the skill lists all components in
`packages/ui/src/components/` and asks which ones to generate. Default is **all** — accept the
default unless you have a specific reason to exclude components. The selection is recorded to
`.agents/figma.config.json → figma.components` so re-runs use it automatically.

Ask the agent to run `@<dsname>/skill-figma-generate --bootstrap-variables`. It:
1. **Heals text styles automatically** (runs `planStyleHeals` before generation — line-height percent
   is restored so the first render is correct with no separate `--heal` step needed).
2. **Materialises Figma variables** from this project's DTCG (Pattern A), binding components to them
   **by name** (separator-stripped, camelCased: `--color-primary-on-brand` → `color/primary/onBrand`).
3. **Generates the selected components** to the full generation contract (real components, own page,
   light+dark, doc header, manifest entry).

On the manual fallback (plugin-as-writer), omit `--bootstrap-variables` and the skill binds to the
plugin's variables instead, falling back to raw values if they're missing.

> **Heal after every Companion Pull.** The Companion plugin re-binds line-height as FLOAT on each
> sync, so after each *Pull from Studio* on the Companion path, run the skill again (it heals
> automatically at the start of generation). The heal registry (`lib/heal.ts`) absorbs future
> variable-model quirks.

## Step 5 — Code Connect (optional)

Code Connect templates are generated from the contract and the manifest, so they exist as soon as
the library does:

1. Generate the templates: `bun run figma:connect`. It reads
   `.agents/figma-generation-contract.json` and `.agents/figma.json` (the Figma node of each
   component, written in Step 4) and writes a `.figma.ts` next to each generated component. A
   window-placed component (dialog, drawer, toast) maps its bare popup component, whose node the
   manifest records as `nodeId`.
2. Commit them. `bun run figma:connect:check` fails when one is
   missing, hand-edited or obsolete, and CI runs it on every pull request.
3. Publish: CI runs `bun run figma:connect:publish` on `main`, or run it yourself from the repo root, or
   publish through the Figma MCP with the Figma plugin's `figma-code-connect` skill.

**Before publishing**, Figma requires:

1. A Dev or Full seat on a Professional, Organization or Enterprise plan.
2. The file in a **team project** (not Drafts or a personal project), published as a library (Main
   menu → Libraries → toggle on "Publish as library"). A bare 403 on publish means one of these
   is missing.
3. `FIGMA_ACCESS_TOKEN` with the Code Connect (write) **and** File content (read) scopes. A
   single-scope token returns a bare 403 with no explanation.
4. `@figma/code-connect` installed (root devDependency) and publishing run from the **repo root**,
   where `figma.config.json` lives: `bun run figma:connect:publish`. Never use `bunx figma`; it can
   download an unrelated npm package.

A component the contract does not cover, or a mapping you want to write by hand, goes through the
official `figma-code-connect` skill (Figma plugin). Keep those files free of the generated header so
the check leaves them alone. See `.agents/figma-connect.md` for the token and CI wiring.

## When tokens change later

Edit in Tokens Studio → `bun run tokens:pull` → `bun run tokens:export` → re-run
`skill-figma-generate --bootstrap-variables`. Variables update in place; re-generating components is
only needed if component *structure* changed (new variant/prop) — pure value changes just re-write the
variables. Code Connect re-publishes via CI on `main`. Because the project stayed the sole variable writer,
there are no duplicates and bindings hold.

(On the manual fallback, "re-run generate" becomes "re-push from the Tokens Studio plugin" — same
single-writer principle, different writer.)
