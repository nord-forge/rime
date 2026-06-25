# Session handoff — Rime

Snapshot to continue work in a fresh session. Update or delete when stale.
Last updated after PR #19 merged. Branch: `main` (clean).

## What this project is
**Rime** — an embeddable, framework-agnostic email template builder. Published under
the **`@nord-forge`** npm scope (NOT `@enveloppe` — that name is gone). Repo:
`github.com/nord-forge/rime`. Packages:
`@nord-forge/rime-{core,model,mjml,react,vue}` + `apps/rime-demo`. Stack: Bun, Lit,
Lexical (headless rich text), MJML export, TypeScript strict, oxlint/oxfmt, Playwright.

## Progress (board is source of truth: `board.md`)
- **44/61 tickets done.**
- **Milestones 0–5 complete.** Milestone 6 (blocks & properties): **12/15** — the full
  block CATALOG now ships. Done: ENV-33 (registerBlock), ENV-34 (seven core blocks),
  ENV-65 (schema field types + open validator), ENV-57 (Heading), ENV-58 (Quote),
  ENV-38 (Social), ENV-60 (Hero), ENV-61 (Column presets), and Batch B —
  ENV-59 (Menu/`mj-navbar`, PR #16), ENV-62 (HTML/`mj-raw` passthrough, PR #17),
  ENV-63 (Video/raw-table poster+overlay, PR #18), ENV-64 (Table/raw-table, PR #19).
- **Remaining in M6: the UI tickets — ENV-35 (properties panel), ENV-36 (palette UI),
  ENV-37 (example custom block).** These consume the schema DSL + registry already built.
- Heading + Quote (PR #12) and Social (PR #13) are Batch A. Custom leaf blocks:
  node interface declared in rime-core (NOT the rime-model union), validated via
  `validateDoc`'s `extraLeafTypes`, exported as native MJML. They go in the core
  set (`registerCoreBlocks`). Pattern to copy for the rest of the catalog.
- Social (PR #13) is the first **list-driven** block — uses ENV-65's `list` field
  type (network+href item fields). Inline SVG icons (no library/network); unknown
  networks fall back to MJML's generic `web` icon. Hrefs guarded by a standalone
  `normalizeHref` copy in `blocks/core/mjml-attrs.ts` (NOT the Lexical-bound
  richtext one) so the export path stays dependency-light. Core 74.49 kB gzip.
- ENV-32 caveat: composition guard + QA checklist landed, but the **real-device iOS
  Safari + CJK IME manual pass is still pending** (needs hardware) — see
  `packages/rime-core/docs/RICHTEXT-QA-FINDINGS.md`.

## Workflow rules (IMPORTANT — confirmed by the user)
- **Each ticket = its own branch + PR.** Branch off `main`; never commit feature work
  to main directly. (Started at ENV-28.)
- **Commits must be signed off** (`git commit -s`) — CI's DCO job requires a
  `Signed-off-by` trailer — and must have **NO** `Co-Authored-By` / AI attribution.
- **Ensure all CI checks are green before merging.** Squash-merge + delete branch.
- **Validate the full CI gate in a FRESH `git clone`** before pushing (NOT cp/worktree —
  they keep stale state). See `.claude/` memory `ci-workspace-resolution`.
- Tickets get `status: done` when finished (review happens once at the end vs a POC).
- **No ticket IDs (ENV-NN/OD-N/§x.y/PRD) in source code** — comments, strings, test
  names, describe() labels. They belong only in `.claude/tickets/`, board.md, PRD.md,
  commit messages. (A whole PR was spent purging these.)
- **Comments only for genuine clarification.** No banners, no per-function doc-comments,
  no file-essay headers. Most comments are noise — default to none.

## Build / CI gotchas (hard-won — don't relearn)
- Run unit tests with `--conditions=development`: the root `test` script already does.
  It selects `@lexical/utils`' working `.dev.mjs` build instead of `.node.mjs`, which
  has a Linux-only `$splitNode before initialization` crash.
- Workspace packages resolve from source via `"bun"`/`"development"` export conditions
  (in each package.json `exports`) — so a fresh checkout works before any build. Vite's
  `resolve.conditions` (in `scripts/vite-lib.ts`) handles the e2e dev server.
- CI runs `bun test` BEFORE `build`, so packages must be resolvable from `src`.
- The size gate (`bun run size`) sums all dist chunks; budget ~100 kB gzip, currently
  ~78.2 kB.
- A pre-existing **drag-preview e2e is quarantined** (`test.fixme`) — flakes on slow CI
  (leftover preview node). Tracked as ENV-26b. Not a regression.

## Architecture notes
- **Barrel split (PR #11):** `@nord-forge/rime-core` root barrel is the PURE SDK (types,
  registerBlock, helpers). The editor element is defined via
  `@nord-forge/rime-core/register` → `defineRimeEditor(config?)` (config:
  `{ coreBlocks?, blocks?, tagName? }`, typed to grow into theme/tokens/enabledBlocks).
  `"sideEffects"` is set: only `register.*` in core; `false` for model/mjml/react/vue.
  Don't reintroduce module-level side effects into the root barrel.
- **Blocks:** every block (built-in or custom) is a `BlockDefinition`
  (`{ type, schema, palette, renderCanvas, renderExport }`) registered via
  `registerBlock`. Canvas reuses `render-node` helpers; export returns `{ mjml }` or
  `{ raw }`. Core export MUST match renderer-mjml output — there's a **parity test**
  (`blocks/core/core-blocks.test.ts`) that renders through both and asserts equality.
  Core duplicates ~3 tiny MJML string helpers (in `blocks/core/mjml-attrs.ts`) rather
  than depending on rime-mjml at runtime; rime-mjml is a core devDependency for the test.
- **Open validator:** `validateDoc(doc, { extraLeafTypes, extraSectionTypes })` accepts
  registered custom leaf + section-level types (validates id + BlockStyle generically;
  block schema validates the rest). Doc-model stays headless — never imports the
  registry. New blocks add their type via these options, NOT by editing the node union.
- **Section-level "band" blocks (PR #14):** the doc model is no longer strictly
  `document→section→column→leaf`. A document's children may be a `SectionNode` OR a
  band block (`DocumentChild = SectionNode | BandBlock`). Blocks declare placement via
  `BlockDefinition.placement: "leaf" | "section"` (default `"leaf"`); DnD/canvas/
  validator key off it, NOT hardcoded type lists. `AnyNode` stays CLOSED/narrowable —
  use `isSection(child)` to narrow doc children (band's open `type` defeats a plain
  `=== "section"`). The **Hero** (ENV-60) is the first band: exports a body-level
  `<mj-hero>` (can't nest in a column). See `.claude` memory `section-level-blocks`.
- **Section-level pointer drop (PR #15):** `resolveSectionDropTarget` resolves a
  drop BETWEEN sections (doc-level insertion index by section midpoint); the DnD
  controller snapshots a `DocumentGeometry` and picks the section- vs column-level
  resolver from the active drag's `placement` (`DndDeps.isSectionLevel`). So bands
  (hero) AND column presets are now pointer-droppable at the document level. The
  indicator draws a full-width line between sections (`sectionIndicatorLineFor`).
- **Column-layout presets (PR #15):** ready-made multi-column structures that drop a
  Section+Column SUBTREE (not a leaf). Live in a separate `PresetRegistry`
  (`blocks/column-presets.ts`, `{ id, label, icon, category, create(newId) }`) read
  by the palette alongside `blockRegistry` — presets all yield `type:"section"`, so
  they can't share the type-keyed block registry. `create()` builds via model
  factories (fresh ids, widths sum 100). Editor `#createBlock` resolves a preset id →
  subtree. Export/canvas/validation are free (plain section/column nodes).
- **CanvasRenderer is registry-aware (PR #14):** non-built-in registered types render
  through their registry `renderCanvas` (fixed heading/quote/social, which previously
  painted as hidden placeholders on the live canvas). The editor's `#createBlock`
  builds palette blocks from registry `palette.defaults`. Editor ops now pass
  `{ extraLeafTypes, extraSectionTypes }` (from the registry) into validate.
- **Section is a styled container:** full-bleed background + padding wrapping its
  column(s) and blocks; a new Section defaults to one 100% column. (User requirement.)
- **Rich text:** Lexical headless, ONE live instance (create-on-focus/destroy-on-blur
  via `RichTextLifecycle`); lossless `RichTextJSON`↔Lexical round-trip in
  `richtext/serialize/serialize.ts`; custom `<eb-rich-text-toolbar>` + `<eb-link-popover>`
  (NO library UI); paste sanitization = curated node set + link-href guard; IME
  composition guard defers blur mid-composition.
- **Canvas DnD = custom pointer events** in the srcdoc iframe (OD-6), NOT a library;
  test with `page.mouse`.

## NEXT UP — the M6 UI tickets (the block catalog is DONE)
The full block catalog ships (ENV-34 core + ENV-57/58/38/60/61/59/62/63/64). What's left
in Milestone 6 is the editor UI that CONSUMES the schema DSL + registry already built:
- **ENV-35 — properties panel:** schema-driven forms. Renders a form per selected block
  from its `BlockSchema.fields` (every `FieldType` now in use: text/number/color/select/
  boolean/spacing/align/url/richtext/multiline/code/**list**). The `list` repeater needs a
  real add/remove/reorder control (menu/social use it; table's 2-D grid was deferred HERE —
  it declares a `rows` list field but needs a dedicated grid control). Edits dispatch
  through `updateNode` (already takes `ValidateOptions`).
- **ENV-36 — palette UI:** categorized, icons, drag source. Reads `blockRegistry.byCategory()`
  AND `presetRegistry.all()` (presets are section-level). Wire each entry via
  `editor.registerPaletteItem(el, typeOrPresetId)` — the DnD + section-level drop already work.
- **ENV-37 — example custom block:** the SDK proof, documented end-to-end.
These unblock the demo (ENV-46).

**Block-authoring crib (for ENV-37 / any new block):** every block is a `BlockDefinition`
`{ type, placement?, schema, palette, renderCanvas, renderExport }` in
`blocks/core/<name>.ts`, added to `CORE_BLOCKS` in `blocks/core/index.ts` + the root barrel
+ the `core-blocks.test.ts` registered-types list. Leaf blocks export `{ mjml }` (native
component) or `{ raw }` (`<mj-raw>` passthrough — html/video/table). For href fields use the
standalone `normalizeHref` in `blocks/core/mjml-attrs.ts` (the richtext one in
`richtext/ui/rich-text-commands.ts` drags in Lexical — keep it out of block/SDK code);
escape labels/attrs with `escapeHtml`/`escapeAttr`. Tests: schema + canvas DOM + export
string + `validateDoc({ extraLeafTypes })` round-trip + compile-through the MjmlRenderer.

## Useful commands
```bash
bun run test            # all unit tests (root, excludes e2e/spikes)
bun run typecheck       # tsc across all 5 packages
bun run lint            # oxlint
bun run format          # oxfmt --write
bun run format:check    # CI format gate
bun run build           # build all packages
bun run size            # bundle-size gate (~100 kB gzip)
cd packages/rime-core && bunx playwright test   # e2e (chromium + webkit)
```
Fresh-clone CI check before pushing:
```bash
cd /tmp && rm -rf rime-x && git clone <repo-or-local-path> rime-x && cd rime-x \
  && git checkout <branch> && bun install --frozen-lockfile \
  && bun run test && bun run typecheck && bun run lint && bun run format:check \
  && bun run build && bun run size && bun run e2e
```
