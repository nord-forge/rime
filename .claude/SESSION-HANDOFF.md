# Session handoff — Rime

Snapshot to continue work in a fresh session. Update or delete when stale.
Last updated on the `optional-lexical` branch (PR open). Branch: see below.

## What this project is
**Rime** — an embeddable, framework-agnostic email template builder. Published under
the **`@nord-forge`** npm scope (NOT `@enveloppe` — that name is gone). Repo:
`github.com/nord-forge/rime`. Packages:
`@nord-forge/rime-{core,model,mjml,react,vue}` + `apps/rime-demo`. Stack: Bun, Lit,
Lexical (headless rich text), MJML export, TypeScript strict, oxlint/oxfmt, Playwright.

## Progress (board is source of truth: `board.md`)
- **47/61 tickets done. MILESTONE 6 COMPLETE (15/15).**
- **Milestones 0–6 complete.** M6 shipped: ENV-33/34/65 (registry + core blocks + schema
  fields), the full block catalog (ENV-57 Heading, ENV-58 Quote, ENV-38 Social, ENV-60
  Hero, ENV-61 Column presets, ENV-59 Menu, ENV-62 HTML, ENV-63 Video, ENV-64 Table),
  ENV-35 (properties panel), ENV-36 (palette), ENV-37 (example coupon block / SDK proof).
- **DONE (post-M6, user request — PR open on `optional-lexical`): Lexical is optional.**
  `defineRimeEditor({ lexicalEditor: false })` / `config.lexicalEditor` (default true) →
  editor DYNAMIC-imports Lexical only when on (code-split into a lazy chunk never fetched
  when off). Off = plain `<textarea>` fallback committing plain RichTextJSON paragraphs.
  Implemented via a `RichTextProvider` seam (`richtext/provider/`): `lexical-provider.ts`
  (the ONLY static Lexical entry, reached solely via `await import()`) + `plain-text-
  provider.ts`. A guard test (`no-static-lexical.test.ts`) locks the no-static-import rule.
- **After that:** Milestone 7 (personalization tokens, ENV-39/40/41) or jump to the demo
  (ENV-46, M9) — M6 unblocked it. Confirm priority with the user.
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
  ~81.8 kB.
- A pre-existing **drag-preview e2e is quarantined** (`test.fixme`) — flakes on slow CI
  (leftover preview node). Tracked as ENV-26b. Not a regression.

## Architecture notes
- **Barrel split (PR #11, ENFORCED in PR #22):** `@nord-forge/rime-core` root barrel is
  the PURE, tree-shakeable SDK (types, registerBlock, registry, blocks, render helpers,
  DOM-free logic) — it pulls in NO Lit custom elements. The editor element + ALL Lit
  chrome UI live on `@nord-forge/rime-core/register`: `defineRimeEditor(config?)`,
  `RimeEditor`/`RimeConfig`/`RimeChangeDetail`/`TokenSource`, `EbPropertiesPanel`,
  `EbPalette`, `RichTextToolbar`, `LinkPopover`, `MoveToMenu`. PR #22 moved these OFF the
  barrel (they had leaked back via the `RimeEditor` re-export) — importing `registerBlock`
  no longer drags in Lit. **Rule:** a value-export on the root barrel must not transitively
  import `lit/decorators`; pure logic co-located with a Lit component (e.g. `destinationsFor`
  in move-to-menu) must be split into its own module (`move-destinations.ts`) to be barrel-
  exported. `"sideEffects"`: only `register.*` in core; `false` for model/mjml/react/vue.
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
- **Rich text (OPTIONAL + behind a provider seam):** the editor depends on a
  `RichTextProvider` interface (`richtext/provider/richtext-provider.ts`), never on Lexical
  directly. `config.lexicalEditor` (default true) selects: the **Lexical provider**
  (`lexical-provider.ts` — headless Lexical, ONE live instance create-on-focus/destroy-on-blur
  via `RichTextLifecycle`, the `<eb-rich-text-toolbar>` + `<eb-link-popover>` inline UI, IME
  composition guard) loaded via `await import()`; or the **plain-text provider**
  (`plain-text-provider.ts` — a `<textarea>`, no toolbar, lossy `RichTextJSON`↔string in
  `plain-text.ts`). Lossless `RichTextJSON`↔Lexical round-trip stays in
  `richtext/serialize/serialize.ts`; paste sanitization = curated node set + link-href guard.
  RULE: `rime-editor.ts` must NOT statically import Lexical (guard: `no-static-lexical.test.ts`).
- **Canvas DnD = custom pointer events** in the srcdoc iframe (OD-6), NOT a library;
  test with `page.mouse`.

## NEXT UP — pick the next milestone (M6 done; Lexical-optional PR open)
Milestone 6 is complete and the post-M6 "Lexical optional" request is done (PR open on
`optional-lexical`). Open options, confirm priority with the user:
- **Milestone 7 — personalization tokens (ENV-39/40/41):** `{{variable}}` merge tags in
  rich text + render handling, a token picker UI, `registerToken`/token-source config. The
  editor already has a `tokenSources` config field + `TokenSource` type as placeholders.
- **Milestone 9 — the demo (ENV-46):** M6 unblocked it; the demo is currently a minimal
  shell (just the coupon SDK proof from ENV-37). Build out the full end-user UX (local
  store, onImageUpload stub, theme showcase).
- **Milestone 8 — persistence/images (ENV-42/43)** or **M9 framework wrappers (ENV-44/45)**.

**Chrome-UI pattern (ENV-35 panel PR #20 + ENV-36 palette PR #21):** both live in their own
dir (`properties/`, `palette/`), render in the shell region (`part="properties"` /
`part="palette"`, Shadow DOM, NOT slotted), and the editor holds a `@query` ref + feeds
state. Pure grouping/assembly logic is factored into a DOM-free helper so it's unit-testable
(`properties/field-path.ts`, `palette/palette-entries.ts`); the Lit component just renders it.
Edits/adds go through the model ops → editor `#dispatch` (panel: `eb-doc-change`; palette:
`eb-palette-add` → `editor.addBlock()`), so undo/redo + ARIA-live are covered. Themed-Lit
components register idempotently (`if (!customElements.get(...))`) and are exported from
`@nord-forge/rime-core/register` (NOT the pure root barrel — see Barrel split). **Gotcha:**
don't set `display` on `rime-editor` from host CSS — it overrides the `:host` grid (the e2e
harness did this; fixed in PR #21).

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
