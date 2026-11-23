---
name: skill-figma-generate
summary: Generate token-bound Figma components from code.
version: 2026.11.08
description: >
  Generate a project's Figma component library FROM its code components (the
  @workspace/ui package), bound to the project's Tokens Studio variables. Produces
  real, themed, self-documented Figma components — one per page. Use when the user
  wants to create/update Figma components from code, build a Figma library, or keep
  design in sync with code. Installs to .claude/skills/ (read natively by the agent).
---

# skill-figma-generate

Drives the **official Figma MCP** (`use_figma`) to generate real Figma components from code.
This skill is a thin wrapper over Figma's first-party skills (`figma-use`,
`figma-generate-library`, `figma-create-new-file`) plus the generation contract.

> **MANDATORY:** load the `figma-use` skill before any `use_figma` call.

## Input — the compiled V2 generation contract (and nothing else)

The skill's **only** source of per-component semantics is the compiled generation artifact,
**`.agents/figma-generation-contract.json`** — the same file the Figma plugin walks. It is
compiled by `bun run figma:contract` from the co-located `<name>.figma.contract.ts` files and carries,
per component, the reviewed contract (axes, parts, slots, anatomy, documentation examples) and its
build-time resolved plan (variant matrix, token bindings, geometry). The project scaffold compiles and commits it
when a project selects a Figma generation flow; there is no skill-only seeding step.

Load it first, through the skill's reader, before any other step:

```ts
import { existsSync, readFileSync } from "node:fs";
import { findArtifactComponent, GENERATION_ARTIFACT_PATH, generateComponentPlan, orderThemeModes, parseGenerationArtifact } from "<this skill>/lib";

const artifact = parseGenerationArtifact(
  existsSync(GENERATION_ARTIFACT_PATH) ? readFileSync(GENERATION_ARTIFACT_PATH, "utf8") : null,
);
// themeModes: the file's `theme` collection mode names (read them in a tiny `use_figma` call), default
// first. Omit it and the page renders one panel, for `documentationTheme.defaultMode`.
const themeModes = orderThemeModes(modeNamesReadFromTheFile, artifact.documentationTheme.defaultMode);
const plan = generateComponentPlan(findArtifactComponent(artifact, "button"), artifact, { themeModes });
```

`parseGenerationArtifact` throws a `GenerationArtifactError` when the artifact is **absent, not JSON,
the wrong file, or a version this skill does not read**. Its message ends with remediation.
**STOP and relay that message to the user verbatim.** Typical remediation:

- The project has co-located contracts: run `bun run figma:contract`, commit the regenerated
  `.agents/figma-generation-contract.json`, and re-run this skill.
- The project has none: it predates the V2 contract. Use the **Figma plugin flow**
  (`.agents/figma-plugin-flow.md`).
- The artifact is newer than the skill: ask the system maintainer for the matching skill revision.
  If the system publishes skill updates, discover and install the exact item from its own registry.

**Never fall back to inferring variant axes, parts or slots from component source.** Generic
inference is *deterministically incomplete*: it cannot reconstruct compound composition,
runtime display states, literal dimensions or assets. It produces a library that looks generated and
is silently missing all four — the exact failure this rule exists to prevent. Refusing is correct;
guessing is not. The same applies per component: a component missing from the artifact
(`findArtifactComponent` throws) needs a contract, not a guess.

**Split sets, shapes and Building Blocks.** A component can generate several component sets, each
declared in its contract, and the plan builds them as the plugin does (`plan.sets`, in order):

- `split` makes one set per value of an axis, or per combination of several (`Primary Button`,
  `Primary Filled Button`). The split axes are no property of a set, so each variant's name leaves them
  out; the cell's full `label` is still what identifies it (`plan.sets[i].cells`).
- `shapes` are kinds of the component, each with sets of its own over the values it holds
  (`Primary Filled Icon Button`). An axis a shape fixes is left out of its variant names too, and a set
  carries only the properties of parts its variants render.
- A Building Block (`buildingBlocks`) is a sub-element with its own states, built as hidden sets before
  the component (`plan.buildingBlocks`: `.Building Blocks/Select/Item`, or one per split value,
  `.Building Blocks/Tabs/Line Horizontal Md Tab`) from its own compiled contract and plan. In the
  parent's variants the part is an INSTANCE of the block variant its item key and the parent's variant
  pick (`buildingBlock.key`), with the item's copy set on it. Its properties belong to the block's sets.

The documentation page gets a Variants section and a captioned definition per set, and lists every
Building Block set beside them. A set over 30 variants is captioned with the contract's `capReason`.

**The focus ring.** A contract's `focusRing` names a ring layer the component's `outline` draws. It is
taken out of the root's flow and, once the root has its box, placed `insetPx` outside it on every side
(or the inset its `insetPxByAxis` gives the variant's value), stretched with the root and unfilled; the
root stops clipping so the ring shows. Its `focus-visible` boolean property shows it. An artifact built
without the tokens' pixel values has no inset: the ring is left in the root and reported in
`ctx.refusedSizes`, never placed at a guess.

## Contracts: schema, commands, and how they land

- **Local schema first, MCP second.** Read the project's own `packages/contracts` before writing or
  judging a contract: `figma-contract.schema.json` (JSON Schema), `src/generation-contract/authored-schema.ts`
  (the Zod source, which the project may have changed) and `src/generation-contract/diagnostics.ts`
  (each refusal code with its remedy). Ask the design-system MCP server, when one is registered, only
  when the local package is missing or you need the current base schema to compare against.
- **Flags only, never prompts.** Run `bun packages/contracts/bin/contracts.mjs <command>` with
  explicit arguments: `validate <slug>`, `check`, `compile`, `list`, `explain <slug>`,
  `new <slug> --yes`. Add `--json` to read diagnostics as data. Exit codes: 0 ok, 1 refusal or drift,
  2 usage, 3 missing prerequisite.
- **Agent-written contracts land by pull request, and a human merges.** Propose a new or changed
  contract in a PR; a passing `check` is evidence for the reviewer, not acceptance.

## Preflight (independent capabilities — check, never assume)

1. **Figma MCP and skills available?** The official Figma plugin supplies the MCP server and the
   `figma-use`, `figma-generate-library` and `figma-create-new-file` skills. Probe for the MCP tools
   (`use_figma`, `whoami`), and confirm `figma-use` (and `figma-create-new-file` on a first run) can be
   loaded: a manually configured MCP server has the tools without the skills. If the MCP is absent,
   STOP and point the user to Figma's setup for the plugin or the remote MCP server. If a skill is
   missing, STOP and tell the user to install Figma's official skills through the Figma plugin. Never
   install either from this skill.
2. **Components present?** The UI package is **`@workspace/ui`** — shadcn's standard monorepo-internal
   scope, installed by the scaffold (`add_items`) and **never renamed** (the local tokens and docs
   packages are namespaced separately). Read `.agents/figma.config.json → uiPackage` to
   confirm/override (default `@workspace/ui`); look for `packages/ui/src/components/*`. If absent (a
   tokens-only scaffold, or an incomplete component installation), consult the system's registry
   documentation and discover the exact component items under its own published namespace.
   Verify their install targets before adding them. If unpublished or unavailable, stop and ask
   the system maintainer for the missing components; do not substitute an upstream library. Each
   installed component ships its `<name>.figma.contract.ts`; run `bun run figma:contract` afterwards
   and reload the artifact so the new components are in it.
3. **DTCG present?** `packages/tokens/dtcg/` must exist (produced by `bun run tokens:pull`). If
   missing → STOP: "run `bun run tokens:pull` (interactive) or `bun run tokens:pull:ci` (service
   token) first — see `.agents/connect-to-figma.md` Step 0 and Step 2."
4. **Variables present?** **Default = Pattern A: this skill writes them** via `--bootstrap-variables` (this
   project owns the variables; Tokens Studio is the token editor/source, not the Figma writer). Bind by
   name afterwards. **Single-writer rule:** variables must have exactly ONE writer — under Pattern A do
   NOT also push from the Tokens Studio plugin to the same file, or the two writers fork the set and the
   next push duplicates your bindings. *Manual fallback (plugin-as-writer):* omit `--bootstrap-variables`,
   let the Studio plugin own the variables, and bind to them by name (resolve raw + ask the user to push,
   then re-run if missing). Pick one writer. Full ordered flow: `.agents/connect-to-figma.md`.
5. **Target file:** first run → `create_new_file`. Follow `figma-create-new-file`'s plan-resolution
   contract: call `whoami` to list the user's plans and ask which team or project to use. **A
   shared team project is the recommended default** for first runs, so file selection needs no setup.
   Code Connect publishing has its own requirements: a token, a published library, and a Dev or Full seat on a Professional, Organization or Enterprise plan. Read
   `.agents/figma.config.json → figma.projectId` / `figma.planKey` for any override the user has
   already set. When blank, ask — never guess or hardcode a planKey.
   Once a user is ready to own their library, they move the generated file out of the Landing Zone into
   their own project and update `figma.projectId`/`planKey` accordingly. Record `fileKey` in
   `.agents/figma.json`.
6. **Component scope (interactive, first run only).** List the components in the generation artifact
   (`artifact.components[].contract.slug`) and ask the user which ones to generate. **Default is
   all** — accept unless the user has a reason to exclude. Record the confirmed list to
   `.agents/figma.config.json → figma.components` so subsequent runs are non-interactive. A component
   in `packages/ui/src/components/` but not in the artifact has no contract: report it, never generate it.

## Deterministic generation: a pure planner over the V2 contract

Generation is **not LLM-improvised** — it is a pure function. The documentation page, like the
per-component semantics, comes from the compiled generation artifact, and the output is
byte-identical every run.

- **Artifact reader** — `lib/artifact.ts → parseGenerationArtifact(text)` checks identity, versions and
  shape, and fails loudly with remediation (see "Input" above). `findArtifactComponent(artifact, slug)`
  picks one component.
- **Pure planner** — `lib/plan.ts → generateComponentPlan(component, artifact, options)` returns a fully
  serializable `ComponentPlan` (documentation page · token bindings · geometry · anatomy). NO Figma I/O, NO `Date`/random, NO LLM. The variant matrix, its bindings and
  geometry, the parts, slots and anatomy tree are carried from the artifact verbatim — the planner
  derives nothing from component source. Same `(component, artifact, options)` → identical plan
  (golden-snapshotted in `tests/`). There is no skill-side design config: the page's look is the
  artifact's `documentationTheme`.
- **Geometry** — `lib/geometry.ts` turns the artifact's per-cell geometry into a
  `CellGeometryPlan` (`plan.geometry[i]`, parallel to `plan.variantMatrix`): layout direction,
  alignment, declared literal size, per-axis sizing and aspect ratio. It is a standalone mirror of the
  plugin walker's decisions, so one artifact yields the same box on both sides. The dimension kinds:
  `variable` binds `width`/`height` (axis FIXED) · `fill` sets `layoutSizing* = FILL` · `literal`
  `resize()`s (axis FIXED) · `hug` is **no instruction** (the auto-layout frame already hugs — this
  includes sizes the browser measures at runtime, declared as hug) · `unsupported` is **refused**. A
  dimension kind the skill does not recognise is refused too. Never compute a size from a refused value
  (`75%`, `min(calc(100vw …))`): leave the axis hugging and report it. `plan.refusedSizes` lists the
  plan-time refusals; run the emitter with `ctx.refusedSizes = []` and `ctx.unresolvedSizes = []` and
  relay both to the user when the run ends (REFUSED SIZES stays empty only when every size is declared).
- **Anatomy, native slots and composed children** — `lib/anatomy.ts` turns the
  contract's anatomy tree into one `AnatomyNodePlan` per variant cell (`plan.cellAnatomy[i]`, parallel to
  `plan.variantMatrix`; `null` = no anatomy for that cell, so the generic label cell is built). Each node
  carries its own bindings (fill / text / stroke / effect style, padding / gap / radius / border /
  opacity / type), its own box (direction, alignment, literal size, per-axis sizing, aspect ratio — a
  `flex-grow` child fills its parent's MAIN axis), its content (a text slot's example characters, an icon),
  and `repeat` / `items`. It is a standalone mirror of the plugin's `buildAnatomyNodePlan`.
  - **Slots come from the contract, never from prop names.** A node whose content lives in a declared slot
    gets `slot: { name, required, stretch, composedChild? }`. The emitter wraps that content in a **native
    Figma slot** (`createSlot()` on the variant, renamed to the slot name; `required` → `minChildren = 1`;
    `stretch` → `stretchChildOnInsert` plus the slot's own cross-axis FILL). If this Figma build has no
    `createSlot()`, or it throws for a slot, that slot keeps **baked content** and is reported in
    `ctx.degradedSlots` — a degraded slot is never silent and never fatal.
  - **A content slot** (`slot.defaultContent`) is a region that accepts arbitrary children. Its frame IS
    the native slot (created with `createSlot()`, filled across the parent's cross axis when `stretch`),
    and the node's children are the default content. Where there is no `createSlot()` the frame stays a
    plain frame holding the same children. Slots inside that default content are placed as plain content
    (Figma does not nest slots).
  - **A composed child** (`slot.composedChild = { component, variantKey?, variantKeyFromAxes? }`) is an
    **instance of that component's variant** (its `variantKey`, else its own axis defaults; each axis
    `variantKeyFromAxes` names follows the parent variant's value, so a Primary Small parent instances a
    Primary Small child), placed in the slot, with this
    parent's resolved overrides for the cell and repeat position (`composedChildOverridesByIndex`: per-corner
    radius, fill, stroke, effect style) applied to the INSTANCE only. Children generate before their
    consumers: call `generationOrder(artifact.components, selectedSlugs)` and run its `order`; `forced`
    lists components pulled in only as a dependency — tell the user. Pass
    `{ components: artifact.components }` to `generateComponentPlan` so each slot resolves to the child's
    variant label (`plan.composedChildren`, one entry per child variant the cells ask for); a child that
    is not in the file, or whose key matches no cell,
    is reported in `ctx.unresolvedComposedChildren`, never substituted.
  - **Declared runtime values** — a size the browser measures at runtime is never
    guessed. When the contract's `runtimeValues` declares one, the planner resolves it from the matching
    documentation example's percent (`runtimeValues: { "thumb-length": "40" }`), exactly as the plugin
    does: a CSS size read from a runtime custom property it `replaces` (Tabs' `var(--active-tab-width)`)
    becomes `sizing.* = { mode: "runtime", fraction, property }`, and a `valueOf` anchor reading a
    `runtimeValue` becomes `sizeAlongMain` / `positionAlongMain: { kind: "travel", fraction }` (the scroll
    thumb). A cell no example declares a value for keeps the refusal.
  - **Out of flow (`removeFromFlow`)** — the emitter exempts the node from its auto-layout parent
    (`layoutPositioning = "ABSOLUTE"`), applies its declared lengths (runtime sizes, `sizeAlongMain`) and
    anchors (`positionAlongMain`; the cross anchor is `overlayCrossAlign`) against the parent's final box,
    then pins it with `constraints` — the Tabs indicator and the scroll-area thumb. A 100% runtime size is
    pinned `STRETCH`. An anchor it cannot apply is reported in `ctx.refusedSizes`.
  - **Typography** — a text node with no DS text style in the file binds family, size, weight, line height
    and letter spacing to their variables by name, the same five fields the plugin binds (a missing variable
    lands in `ctx.unresolvedSizes`). The literal `literalGeometry` size / line height still apply after.
    A bound FLOAT line height renders as px until the type styles are healed (see "Heal").
  - **Overlay placement** — a node with an `overlayCrossAlign` under an OVERLAY parent is placed
    on the cross axis, then ALONG the main axis exactly as the plugin does: `sizeAlongMain` pins a length at
    the origin, `travel` moves through the free space, `valueOf` centres at the fraction, `stretch` spans,
    `start`/`center`/`end` anchor; a `refused` position is not rendered at a guessed offset. A node the plugin
    would not place (an overlay child with a position but no `overlayCrossAlign`) lands in `ctx.unplacedParts`; the committed
    artifact has none. Relay it, `ctx.failedIconPaths`, `ctx.failedImageAssets` and
    `ctx.unresolvedBindings` to the user when the run ends.
  - **Icons and embedded images** — an `icon` part is built from its embedded
    complete `<svg>` (`iconSvg`) through `figma.createNodeFromSvg`, verbatim, sized from its bound size
    variable (else its literal size, else 12), and coloured from the part's `text` binding on whichever
    paint channel each leaf carries (a stroke icon stays an outline). It is a slot like any other part:
    the contract's declared slot wraps it natively. An icon that cannot be built (no `iconSvg`, or the
    import throws) becomes a visible dashed placeholder named `⚠ icon: <part>` and is listed in
    `ctx.failedIconPaths`; it is never dropped silently. A cell with no anatomy tree but a cell `iconSvg`
    gets a 20px icon coloured from the cell's `text` binding. An `image` part embeds `imageData` /
    `imageMimeType`: SVG through `createNodeFromSvg`, PNG/JPEG through `figma.createImage` on a rectangle's
    IMAGE fill (no background colour is applied over it). A bad or missing asset inserts no node and is
    listed in `ctx.failedImageAssets`. Both lists are empty for the committed artifact.
- **Window-placed components** — a contract with a `viewport` (dialog,
  alert-dialog, drawer, toast) has a `context` axis. `lib/viewport.ts` plans, per `context=viewport` cell,
  the **viewport stand-in frame** (`plan.viewport[i]`): width bound to the existing `web/breakpoint/view`
  variable, height hugging, each padding side bound BY NAME to the token the CSS margin names, the popup
  placed `center` / `docked` (per the dock axis, e.g. drawer's `side`) / `corner`, the popup's width FILL
  with the CSS `min()` cap as `maxWidth`, and the backdrop rendered from its own CSS behind the popup. It
  also plans the **popup component** (`plan.popup`): `<ComponentName> Popup`, built FIRST from the
  `context=component` cells (a component set when other axes remain — Drawer Popup has `side`). Every
  variant of the set, in both contexts, holds an **instance** of the matching popup variant
  (`plan.popupVariants[i]`): the popup component is the Code Connect target. Everything comes from the
  compiled contract; a viewport the contract cannot honour throws with "rebuild the artifact", and a
  missing frame-width variable stops the run. Standalone mirror of the plugin's `viewportFramePlan` /
  `withPopupComponent`.
- **Documentation page** — `lib/documentation-page.ts` plans the page from the artifact alone: the closed
  `documentationTheme` role vocabulary, `documentationPage` (docs origin, brand wordmark) and each
  contract's `description` and `documentation.examples` (see "Documentation page design"). It is a
  standalone mirror of the plugin's `documentation-layout.ts`, so one artifact yields one page on both
  sides. `lib/doc-config.ts` and the `Doc/*` kit are retired.
- **Thin emitter** — `lib/emit.ts` walks the plan and creates Figma nodes via `use_figma`. The ONLY
  impure layer; only node IDs vary. **Inline `lib/emit.ts` + `lib/emit-core.ts` into the `use_figma`
  script** and call `renderComponentPlan(plan, ctx)` **once per component, in its own call on a fresh
  page** — see "Driving `use_figma`" below. Don't re-derive these primitives by hand.

**What `lib/emit.ts` provides** (Kumo's `packages/kumo-figma/shared.ts` technique):
`createAutoLayoutFrame` (transparent by default; mode/padding/itemSpacing/sizing, hug by default);
`bindFill` / `bindStroke` / `bindTextColor` (base `SolidPaint` → `setBoundVariableForPaint`, raw fallback
when the variable is absent); `createText` (loads the font BEFORE `characters`); `buildTextStyleIndex`
(DS text styles by name → id, built ONCE per run like the variable index);
`renderComponentPlan` (creates the page, builds the component set, then renders the plan's
documentation page and places the master set beside it). Chrome is resolved from `documentationTheme`
roles only: spacing / colour / radius roles bind the file's **variables** by name, the three text-style
roles apply its **text styles** by name. A role the file cannot resolve **throws** with the role and the
missing name (as the plugin does) — there is no raw size, weight, font or colour fallback. Variables bind **by name** via
`lib/emit-core.ts` (`resolveBinding`,
separator-stripped + camelCase-aware). Text styles resolve through `resolveTextStyleName` (exact name,
then hyphens-as-slashes, then the one style whose name below its top-level group equals the tier — a
component's `typography/paragraph/md` finds the synced `text-style/paragraph/md`; two matches are
ambiguous and bind nothing) — no Tailwind→px table; geometry is `var(--token)` refs
that map 1:1 to same-named variables. Re-runs use `reconcileManifest` (`emit-core.ts`) for upsert
(create / update-in-place / skip-unchanged) against `.agents/figma.json` — never a destructive purge.

> `renderComponentPlan` builds the variant grid and the real component set itself: each cell is the
> contract's anatomy tree (`plan.cellAnatomy[i]`) when it declares one, else the generic label cell.
> Initialise the context once per script with the run-state fields: `refusedSizes`, `unresolvedSizes`,
> `unresolvedBindings`, `degradedSlots`, `unresolvedComposedChildren`, `unplacedParts`, `failedIconPaths`,
> `failedImageAssets` (all `[]`), `nativeSlotsAvailable: false`, `generated: new Map()`, `composedChildren: new Map()` and
> `composedChildLabels: {}`. A composed child built in an EARLIER call is found in the file by the name
> of the child's set that holds it and its variant name there (`composedChildren[i].setName` /
> `variantName`).

## Driving `use_figma`

Follow the `figma-use` skill for every write: how to structure scripts, return values, verifying that
a write landed, screenshot validation, and Plugin API pitfalls. Project-specific rules on top of it:

- Call `renderComponentPlan` once per component, in its own call, on a page that call creates. Never
  write into a page a prior call created.
- The documentation chrome is inline nodes on the component's own page, never an instance of a shared kit.
- Upsert variable collections by name; deleting pages does not remove them, so a blind create duplicates.

### Host API constraints (the MCP `use_figma` runtime)

The emitter is written against these; keep it that way, and don't "simplify" back to the API the
Plugin docs show, which only exists for private plugins or in the full editor runtime:

- **`setPluginData` / `getPluginData` are rejected** ("not supported in this host runtime (only
  private plugins on web can use it)"). The emitter tags its icon and popup components with
  `setSharedPluginData` under the `focus.generated` namespace instead. A shared-data namespace must
  be >= 3 chars, alphanumeric/`_`/`.`.
- **`loadAllPagesAsync` is rejected** ("not a supported API"), and `figma.root.findOne` requires the
  whole document loaded. `findComponentSetByName` loads one page at a time with
  `PageNode.loadAsync()`, which this host does support, and skips a page that refuses.
- **A script does not read back its own writes.** `setSharedPluginData` is committed when the script
  ends, so a later `getSharedPluginData` in the SAME script returns the OLD value. Staging data for
  the emitter therefore takes one call to write and a separate call to read.
- **`code` is capped at 50 000 characters**, and each shared-plugin-data entry at 100 kB. Past a few
  tens of kB, do not chunk the plan through `code` at all — use the image channel below.
- Text passed into a script is **NFC-normalised in transit**. Any encoding of the plan must survive
  that: avoid combining marks (`U+0300`–`U+036F`) and canonical singletons (`U+037E` → `;`,
  `U+0387` → `·`) as sentinel characters.

### Moving a large plan in: the image channel (`utils/png-transport.mjs`)

The 50 000-character `code` cap is not a data limit, it is a **typing** limit: every character in
`code` is authored by the agent, one token at a time. Splitting a plan into verified chunks works at
tens of kB and stops working well before a megabyte — the transcription becomes the unreliable step,
and a wrong chunk is indistinguishable from a right one until a hash disagrees. Button's plan is
5 076 795 bytes (~111 kB of base64). Do not try to type it.

`upload_assets` is a byte channel that sidesteps the cap entirely. Encode the plan as the **pixel
data** of an 8-bit grayscale PNG, POST the file with `curl`, and read the bytes back in-plugin with
`figma.getImageByHash(hash).getBytesAsync()`. Figma stores the PNG verbatim, so the round trip is
lossless — a 5 MB plan decodes in-plugin in about 1.2 s.

```bash
node .agents/skills/skill-figma-generate/utils/png-transport.mjs plan.json plan.png
# -> {"payloadLen":5076795,"djb2":"9076ae4d","width":2048,"height":2479,...}
curl -sS -X POST "<submitUrl>" -F "file=@plan.png;type=image/png"
# -> {"success":true,"imageHash":"...","sizeBytes":5080309}
```

Rules that matter:

- **`sizeBytes` in the POST response must equal the local file size.** That is the proof Figma did
  not re-encode the image. If it differs, stop — the pixels are not your bytes.
- **The IDAT stream uses stored (uncompressed) deflate blocks** (`deflateSync(raw, { level: 0 })`).
  A general inflater inside `use_figma` would be ~2 kB of hand-written Huffman decoding, which is
  back to typing; a stored-block reader is ~15 lines. Size costs nothing because `curl` uploads it.
- **Assert the djb2 of the decoded payload before rendering.** It is the only thing between a
  truncated read and a half-generated page. Inline `DECODER_SOURCE` from `png-transport.mjs`; it is
  small enough to author by hand, and it is the one piece that still has to be.
- **Globals do not survive between `use_figma` calls.** Decode the bundle, `eval` it, decode the
  plan, and render in the SAME call.
- **`figma.root.getSharedPluginData` is read-only** — you cannot monkey-patch the accessor to feed a
  plan to a runner that reads from plugin data. Give the runner an explicit plan argument instead.
- **Each upload places a frame on the canvas** — on `currentPageId`, or on the FIRST PAGE when that
  is omitted. That is a real mutation of a page you may have been told to leave alone. Pass
  `currentPageId`, remove the node once the render lands, and verify the page's children are back to
  what they were. Clear any staging keys you wrote with `setSharedPluginData(ns, key, "")`.

The same channel carries the compiled emitter bundle itself (~41 kB), which removes the last reason
to paste minified code into `code`. Note the bundle is UTF-8 while a plan is pure ASCII — pass
`toStr(bytes, true)` for the bundle, `toStr(bytes, false)` for the plan.

### Loading fonts before applying a text style

`setTextStyleIdAsync` re-fonts the node. Every write after it — `characters`, `fontSize`,
`lineHeight`, `textAlignHorizontal`, `textCase`, even `appendChild` — then targets a node carrying
the style's font, and Figma rejects writes to a node with an unloaded font. **Call
`loadTextStyleFont(styleId)` before every `setTextStyleIdAsync`.** The fallback family loaded by
`createText` is not enough: the DS styles use the brand family (Work Sans here, not Inter).

## Generation contract — Definition-of-Done (NON-OPTIONAL, do not skip any)

For EVERY component (the planner produces 0–6; the emitter renders + asserts them):

0. **Slot analysis FIRST.** Read the slots from the contract (`plan.slots`, each tied to a part in
   `plan.anatomyTree`) — never from component source or prop names. The emitter models them as the plugin does:
   | Slot in the contract | Figma model |
   |---|---|
   | a part's content (text, icon) | a **native slot** on the variant, named for the slot; baked content + `degradedSlots` if unavailable |
   | `composedChild` (a slot holding another component) | a native slot whose default content is an **instance** of the child's variant, with this parent's overrides on the instance |
   | nested anatomy parts | frames/text/shapes of the variant's own tree, each with its own bindings and box |
1. **Real components for what is a component** — the component set, every variant, and every composed child
   instance. Anatomy parts inside a variant are nodes of its tree, as in the plugin.
2. **Own page** named for the component (collision-proof; matches self-contained model).
3. **Documentation page** — Header, Title, Copy me, divider, Variants — every value a `documentationTheme`
   role (see "Documentation page design").
4. **One Variants panel per theme mode**, each pinned with
   `frame.setExplicitVariableModeForCollection(themeCollection, modeId)`; the master set sits beside the
   page. (Theme is NOT a variant property.)
5. **Slice caption** naming the pinned axes, so the page never implies it shows every variant.
6. **Manifest** entry in `.agents/figma.json` (component, slot components, parts, node ids, version).
7. **Code Connect** — not drawn here: the templates are generated from the contract and this manifest (see `skill-figma-library`, only when Code Connect is enabled).
8. **Self-check** asserting 0–7 exist, incl. *no frame standing in for a component or slot*; report gaps.

**Before component generation (NON-OPTIONAL):** ensure the DS type styles are current, then **Heal** them
(see "Heal" above). On the Companion path, **PROMPT the user to run a Tokens Studio Companion Pull/sync on
the type styles FIRST** — then run `planStyleHeals` → unbind + set raw over all local text styles, and only
then generate. Chrome applies these styles by name, so healing before generation means the first render
already carries correct line-heights (a bound-FLOAT `%` otherwise renders as px).

## `--bootstrap-variables` — this skill writes the variables (Pattern A default)

Materialise the project's Figma variables from its DTCG (`packages/tokens/dtcg/`), so this skill is the
single writer and the plugin isn't needed. **Upsert, never purge** — read the file's existing variables
first and update in place so component bindings (by variable id) survive across runs.

1. **Read** `$themes.json` (theme group → modes) + `$metadata.json` (set order) + the token-set files.
2. **Collections = theme groups, modes = theme names.** For each group (`theme`, `web`, `brand`,
   `semantic-web`, …) get-or-create a `VariableCollection` of that name; add the modes it lists
   (`theme` → light/dark, `web` → lg/md/sm; single-mode groups keep one mode). Match existing by name —
   never create a duplicate collection/mode.
3. **Variables = slash-path token names.** For each token, get-or-create a variable of the slash name
   (`brand/color/base/primary`) in its collection with the right resolved type (COLOR/FLOAT/STRING).
   Match existing by collection+name and reuse its id.
   - **Scopes:** set `variable.scopes` explicitly, as `figma-use` requires, on creation **and when reusing an existing
     variable** (so one left at `ALL_SCOPES` is corrected). **Never
     `ALL_SCOPES`**, which is the default and pollutes every picker. By variable type:
     background and surface colors → `["FRAME_FILL", "SHAPE_FILL", "EFFECT_COLOR"]`; text colors →
     `["TEXT_FILL"]`; border and stroke colors → `["STROKE_COLOR"]`; corner radius →
     `["CORNER_RADIUS"]`; spacing and gap → `["GAP"]`; sizes → `["WIDTH_HEIGHT"]`; font size →
     `["FONT_SIZE"]`; opacity → `["OPACITY"]`; blur and other effect numbers → `["EFFECT_FLOAT"]`.
     Primitives that only feed aliases (raw ramps, base scales) and any token with no matching scope →
     `[]`, hidden from every picker. Match the scope pattern of any variables already in the file.
   - **WEB code-syntax:** for every variable set `variable.codeSyntax = { WEB: "var(--<kebab-name>)" }`
     (where `<kebab-name>` is the DTCG key with `/` replaced by `-` and any remaining camelCase
     segments lowercased). This wires the "Copy as CSS" Dev Mode output to the actual CSS variable name.
4. **Values per mode.** Set each mode's value with `setValueForMode`. Colors → `{r,g,b,a}` 0–1; numbers
   → FLOAT; strings → STRING. **DTCG references (`{a.b.c}`) → variable ALIASES** (`createVariableAlias`
   to the referenced variable) — preserve the cascade, don't flatten. Typography: apply the same
   RAW-vs-bind rules as below (lineHeight/letterSpacing/fontFamily RAW via `typography-to-figma.ts`).
5. **Report** created vs updated counts. Then proceed to component generation, binding by name as usual.

Requires the Figma MCP (Plugin API via `use_figma`). Enterprise not required for this path (Plugin API,
not the REST Variables API). The headless REST-Variables-API equivalent is a roadmap follow-up for
sandbox/CI variable sync without a Figma session.

## Heal — normalize what the variable model can't express (`lib/heal.ts`)

Some token semantics don't survive the trip into Figma variables, and it doesn't matter who wrote them
(`--bootstrap-variables` **or** the Tokens Studio **Companion** plugin). The motivating case is
**line-height**: Figma variables are typed COLOR/FLOAT/STRING — there is **no percent type** — so a
`130%` line-height token becomes a FLOAT `1.3`, and a line-height *bound* to a FLOAT **renders as
PIXELS** (`1.3px`), collapsing the text. Figma supports `%` line-height natively; only the *binding*
forces px. Token exports now give line-heights as **px** (`round({size} * ratio)`), which bind and resolve
correctly — never `%`/`em`. For legacy ratio tokens the fix is to set line-height **raw as PERCENT**
(unbound): `1.3` → `130%`.

**Heal is a first-class, extensible step, and runs in TWO modes:**
- **Automatically (no separate call needed)** — heal always runs **before component generation**, ALWAYS
  over the local text styles so the first render is correct with no manual `--heal` step. This is now
  WIRED: `renderComponentPlan` calls `applyStyleHeals()` (emit.ts) as its first action, guarded by a
  module flag so it heals once per inlined script even across a multi-component loop. (Earlier this was
  documented but not actually invoked — a real run rendered a collapsed header until it was wired in.)
  On the Companion path (Pattern B), Companion re-binds line-height as a FLOAT on each sync, so **prompt
  the user to run a Companion Pull first**, then re-run the skill — it heals automatically before generating.
- **Standalone** — invoke as `@<dsname>/skill-figma-generate --heal` (or "heal the line-heights") to fix
  an existing file's styles without regenerating components.

**How** — inline `lib/heal.ts` into the `use_figma` script (like `emit.ts`), then:
1. `const styles = await figma.getLocalTextStylesAsync()` → map each to `{ name, lineHeight, boundVariables }`.
2. `const actions = planStyleHeals(styles)` (pure — one action per affected style).
3. For each action: **unbind** the listed fields (`style.setBoundVariable(field, null)`), then **set** the
   raw value (`style.lineHeight = patch.set.lineHeight`). Load the style's font first.
4. Report healed vs skipped counts.

Healers live in `STYLE_HEALERS` (`lib/heal.ts`) — the first is `line-height-ratio-to-percent`. **Extend
the registry** as new Figma-model quirks surface (letter-spacing em↔px, effect-color rounding, …): add a
`{ name, reason, detect, heal }` and it's picked up everywhere heal runs. `skill-figma-fidelity-check`
asserts no healed quirk regressed (e.g. no text style left with a ratio-as-px line-height).

## Mapping rules (validated)

- **Contract axes → variant properties.** Every axis in `plan.propsSummary.rows` (from the resolved
  plan's `variantAxes`) is a Figma VARIANT property, values 1:1. Display axes Figma can't replay
  (`availability`, `focus`, `content`, …) are already declared by the contract — never add your own.
- **Bind by name with separator-stripped normalization.** `--a-b-c` does NOT map to `a/b/c` naively —
  multi-word segments are camelCased (`--color-primary-on-brand` → `color/primary/onBrand`). Match by
  `name.replace(/[-/_]/g,'').toLowerCase()` on both sides. Report matched / missing / ambiguous.
- **Bindable:** fills/strokes (`setBoundVariableForPaint` → capture the returned paint), padding/gap/
  radius/`strokeWeight`/`opacity` (`setBoundVariable`), and text **`fontSize`/`fontWeight`**.
- **Variant-cell label = the component's DS type ramp, NOT a raw font.** The resolved geometry's
  `textStyle` (e.g. `typography/button`) is applied to each cell's label by name
  (`setTextStyleIdAsync`).
- **Per-cell geometry from the artifact.** Each cell's `geometry` (overlaying `plan.baseGeometry`)
  carries the padding/gap/radius token names; the emitter binds them per cell so `sm/md/lg` render at
  genuinely different sizes.
- **Box geometry comes from `plan.geometry`, never from a default.** Direction is the contract
  anatomy root's `layout` (`overlay` → `NONE`, no clipping), else the CSS-derived `layoutMode`, else
  `HORIZONTAL`; alignment is the CSS-derived value, else `MIN` (Figma's own default — not `CENTER`).
  Padding and gap bind only when the artifact names a token; there is no hardcoded fallback. The box
  is applied LAST, in the plugin's order: declared literal size, then per-axis sizing, then
  `aspect-ratio` as a reshape of the box sizing just produced.
- **Set RAW, never bind (Figma applies a bound FLOAT as PIXELS):** `lineHeight`, `letterSpacing`,
  `fontFamily`. Use `typography-to-figma.ts` (`toFigmaLineHeight` handles DTCG `1.3` *or* `130%`;
  `toFigmaLetterSpacing`; `toFigmaFontFamily` strips the CSS stack). fontFamily can't bind (Studio value
  is a CSS stack).
- **Shadows aren't variables** → emit a `DROP_SHADOW` effect (or a generated effect style). Approximate
  `box-shadow` tokens; bind effect color via `setBoundVariableForEffect` where useful.
- **`width:100%`** → `{ kind: "fill" }` → `layoutSizingHorizontal = "FILL"`, legal only under an auto-layout
  parent (a variant root is not one: the emitter reports it as refused rather than inventing a width).
- **`opacity-soft` disabled** → `setBoundVariable("opacity", v)`.

## Project-specific Figma facts

Plugin API behaviour is covered by `figma-use`. Only the facts specific to this file model:

- The `theme` collection lists `dark` first, so its default mode is `dark`. Set the default to `light`, or
  read the variants inside the per-mode sections.

## Documentation page design (deterministic, not improvised)

The page is the **result of the plugin's page plan**, not a skill-side design. `lib/documentation-page.ts`
builds it from three artifact inputs, and the emitter renders it — the same anatomy the Figma
plugin renders for the same artifact:

1. **Header** — the `documentationPage.brandName` wordmark. Omitted when the project configures none.
2. **Title** — the contract's `componentName`; then `contract.description`; then a `Documentation` link
   (a real Figma hyperlink) to `${documentationPage.docsBaseUrl}/${slug}`. Each is omitted when its data is
   absent — never a placeholder.
3. **Copy me** — a labelled row per `contract.documentation.examples` entry, each an **instance** of the
   real variant cell its `key` names. Omitted when the contract declares no examples.
4. **Divider**, then **Variants** — a readable 2-axis **slice** per theme mode, stacked: a column axis
   (`variant` / `size` / `tone` / `intent` / `kind`) by one row axis (`mode` / `state` first); every other
   axis is pinned to its declared default and **named in a caption** (`size: md · availability: enabled`).
5. **Component definition** — the master component set (every variant, including those the slice omits),
   captioned, in its own frame placed **beside** the page (one gutter to the right, top-aligned), so it
   never disturbs the page's auto-layout flow. For a window-placed component the column is headed by the
   **popup component**, captioned as the component Code Connect maps to the React component.

**Every visual choice is a role** from the artifact's closed `documentationTheme` vocabulary: surfaces
(`page`, `section`), `text` / `textSubtle`, `divider`, `radius`, spacing (`rowGap`, `contentGap`,
`sectionGap`, `pageGutter`), and three text styles (`titleStyle`, `bodyStyle`, `captionStyle`). The plan
holds role names only; the emitter resolves each to the file's variable or text style by name. **No literal
spacing, font, size or hex appears in the chrome** (AGENTS.md anti-pattern, same as the plugin). A value the
roles do not cover is a reviewed change to the project's `packages/contracts/contracts.config.ts`
(`documentationTheme`), then `bun run figma:contract` — never an inline number in the skill.

Consistency comes from: (1) the page plan being a pure function of the artifact; (2) golden snapshots
(`tests/plan.test.ts`); (3) `tests/documentation-page.test.ts`, which fails when the skill's page plan
drifts from the plugin's for any component of the committed artifact; (4) `skill-figma-fidelity-check`.

## Enforcement (with `skill-figma-fidelity-check`)

- **Golden snapshots** — `tests/plan.test.ts` asserts the planner output is byte-identical.
- **Parity gate** — `tests/emitted-parity.test.ts` runs this skill's `renderComponentPlan` and
  the plugin's `generateComponents` against one in-memory Figma and compares the emitted node trees for
  every component of the artifact. It runs in CI. A divergence is fixed on the side that guesses.
- **Plan↔Figma self-check** — after the emit, assert every plan zone exists in the file (the Definition of
  Done in `skill-figma-fidelity-check`).

## References
- `lib/` — the artifact reader (`artifact.ts`), the pure planner (`plan.ts`), the documentation page
  plan (`documentation-page.ts`), the emitter (`emit.ts` — inlined into `use_figma`). Tests +
  golden snapshots in `tests/`.
- `utils/typography-to-figma.ts` — DTCG→Figma typography normalizer (co-located, ships with this skill)
- `utils/png-transport.mjs` — PNG byte channel for payloads past the `use_figma` `code` cap: Node-side
  encoder (CLI) plus `DECODER_SOURCE` to inline in-plugin
- `figma-use` (first-party) — Plugin API rules
- `cloudflare/kumo` `packages/kumo-figma` — `shared.ts` auto-layout/binding primitives + `drift-detection`
- Design rules: generation contracts are explicit and complete; one build-time resolved plan is walked
  by every materializer; parity is compared on emitted nodes; this skill is a supported peer of the
  plugin.
