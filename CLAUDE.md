# Rime — project guide

**Rime** — an embeddable, framework-agnostic email template builder. Published under
the **`@nord-forge`** npm scope. Repo: `github.com/nord-forge/rime`. Packages:
`@nord-forge/rime-{core,model,mjml,react,vue}` + `apps/rime-demo`. Stack: Bun, Lit,
Lexical (headless rich text, optional), MJML export, TypeScript strict, oxlint/oxfmt,
Playwright.

Progress + tickets: **`board.md`** is the rollup; detailed tickets live in
`.claude/tickets/` (read `_conventions.md` first). Ticket frontmatter `status:` is the
source of truth.

## Workflow rules (confirmed by the user)
- **Each ticket = its own branch + PR.** Branch off `main`; never commit feature work to
  main directly.
- **Commits must be signed off** (`git commit -s`) — CI's DCO job requires a
  `Signed-off-by` trailer — and must have **NO** `Co-Authored-By` / AI attribution.
- **All CI checks green before merging.** Squash-merge + delete branch.
- **Validate the full CI gate in a FRESH `git clone`** before pushing (NOT cp/worktree —
  they keep stale state). See `.claude` memory `ci-workspace-resolution`.
- Tickets get `status: done` when finished (review happens once at the end).
- **No ticket IDs (ENV-NN/OD-N/§x.y/PRD) in source code** — comments, strings, test
  names, describe() labels. They belong only in `.claude/tickets/`, board.md, PRD.md,
  commit messages.
- **Comments only for genuine clarification.** No banners, no per-function doc-comments,
  no file-essay headers. Default to none.

## Build / CI gotchas (hard-won — don't relearn)
- Run unit tests with `--conditions=development` (the root `test` script does): selects
  `@lexical/utils`' working `.dev.mjs` over `.node.mjs`, which has a Linux-only
  `$splitNode before initialization` crash.
- Workspace packages resolve from source via `"bun"`/`"development"` export conditions
  (each package.json `exports`) — a fresh checkout works before any build. Vite's
  `resolve.conditions` (`scripts/vite-lib.ts`) handles the e2e dev server.
- CI runs `bun test` BEFORE `build`, so packages must be resolvable from `src`.
- The size gate (`bun run size`) sums all dist chunks (~100 kB gzip budget) AND, for
  rime-core, enforces **per-entry eager-load budgets**: it walks the static-import
  closure of `index.js` (pure SDK) and `register.js` (editor) and FAILS if Lexical
  leaks into either (ENV-66). The all-chunks total alone is blind to eager loading.
- A pre-existing **drag-preview e2e is quarantined** (`test.fixme`) — flakes on slow CI.
  Tracked as ENV-26b. Not a regression.
- **Don't set `display` on `rime-editor` from host CSS** — it overrides the `:host` grid
  (palette | canvas | properties). The e2e harness hit this; size the element instead.

## Architecture notes
- **Pure SDK barrel (PR #11, enforced #22):** `@nord-forge/rime-core` root barrel is the
  PURE, tree-shakeable SDK (types, registerBlock, registry, blocks, render helpers,
  DOM-free logic) — pulls in NO Lit custom elements. The editor element + ALL Lit chrome
  UI live on **`@nord-forge/rime-core/register`**: `defineRimeEditor(config?)`, `RimeEditor`/
  `RimeConfig`/`RimeChangeDetail`/`TokenSource`, `RimePropertiesPanel`, `RimePalette`,
  `MoveToMenu`. The **Lexical-coupled** rich-text surface — `mountLexical`, serialize
  (`$applyRichTextJSON`/`canonicalize`/…), `RichTextLifecycle`, `makeCommands`,
  `registerSelectionFormat`, and the Lexical-bound chrome `RichTextToolbar`/`LinkPopover`/
  `RimeTokenPicker` — lives on a THIRD deep entry **`@nord-forge/rime-core/richtext`** (ENV-66),
  NOT on `/register`: re-exporting them from `/register` dragged Lexical into the eager
  `register.js` closure. The editor mounts that chrome via the dynamic Lexical provider.
  **Rule:** a value-export on the root barrel (or `/register`) must not transitively import
  `lit/decorators` OR `lexical`/`@lexical/*`; pure logic co-located with a Lit/Lexical
  module (e.g. `destinationsFor`, `normalizeHref`) must be split into its own module to be
  barrel-exported. Guarded by `no-eager-lexical.test.ts` (walks the source import graph of
  `index.ts`/`register.ts`) + the eager-budget size gate. `"sideEffects"`: only `register.*`
  in core; `false` for model/mjml/react/vue.
- **Blocks:** every block (built-in or custom) is a `BlockDefinition`
  (`{ type, placement?, schema, palette, renderCanvas, renderExport }`) registered via
  `registerBlock`. Canvas reuses `render-node` helpers; export returns `{ mjml }` (native
  MJML) or `{ raw }` (`<mj-raw>` passthrough). Core export MUST match renderer-mjml — a
  **parity test** (`blocks/core/core-blocks.test.ts`) asserts equality. Core duplicates ~3
  tiny MJML string helpers (`blocks/core/mjml-attrs.ts`) rather than depending on rime-mjml
  at runtime. For href fields use the standalone `normalizeHref` in `mjml-attrs.ts` (the
  richtext one drags in Lexical); escape with `escapeHtml`/`escapeAttr`.
- **Open validator:** `validateDoc(doc, { extraLeafTypes, extraSectionTypes })` accepts
  registered custom leaf + section-level types (validates id + BlockStyle generically; the
  block schema validates the rest). Doc-model stays headless — never imports the registry.
- **Section-level "band" blocks:** the tree is not strictly `document→section→column→leaf`.
  A document's children may be a `SectionNode` OR a band (`DocumentChild = SectionNode |
  BandBlock`). Blocks declare `placement: "leaf" | "section"` (default leaf); DnD/canvas/
  validator key off it, not hardcoded type lists. `AnyNode` stays CLOSED/narrowable — use
  `isSection(child)` (band's open `type` defeats a plain `=== "section"`). Hero is the first
  band (body-level `<mj-hero>`). See `.claude` memory `section-level-blocks`.
- **Section-level pointer drop:** `resolveSectionDropTarget` resolves a drop BETWEEN
  sections; the DnD controller snapshots a `DocumentGeometry` and picks section- vs
  column-level resolver from the drag's `placement` (`DndDeps.isSectionLevel`). Bands +
  column presets are pointer-droppable at the document level.
- **Column-layout presets:** drop a Section+Column SUBTREE (not a leaf). Live in a separate
  `PresetRegistry` (`blocks/column-presets.ts`) read by the palette alongside `blockRegistry`
  (presets all yield `type:"section"`, so can't share the type-keyed registry). `create()`
  builds via model factories (fresh ids, widths sum 100).
- **CanvasRenderer is registry-aware:** non-built-in registered types render through their
  registry `renderCanvas`. The editor's `#createBlock` builds palette blocks from registry
  `palette.defaults`; ops pass `{ extraLeafTypes, extraSectionTypes }` into validate.
- **Section is a styled container:** full-bleed background + padding wrapping its column(s);
  a new Section defaults to one 100% column.
- **Rich text (OPTIONAL, behind a provider seam):** the editor depends on `RichTextProvider`
  (`richtext/provider/richtext-provider.ts`), never on Lexical directly. `config.lexicalEditor`
  (default true) selects the **Lexical provider** (`lexical-provider.ts` — headless Lexical,
  ONE live instance create-on-focus/destroy-on-blur via `RichTextLifecycle`, the
  `<rime-rich-text-toolbar>` + `<rime-link-popover>` UI, IME composition guard) loaded via
  `await import()`; or the **plain-text provider** (`plain-text-provider.ts` — a `<textarea>`,
  lossy `RichTextJSON`↔string in `plain-text.ts`). Lossless richtext↔Lexical round-trip in
  `richtext/serialize/serialize.ts`. **Rule:** `rime-editor.ts` must NOT statically import
  Lexical (guard: `no-static-lexical.test.ts`) — only via the dynamic split.
- **Chrome UI (panel/palette):** each in its own dir (`properties/`, `palette/`), rendered in
  the shell region (Shadow DOM, themed by `--rime-*`), editor holds a `@query` ref + feeds
  state. Pure grouping/assembly factored into DOM-free helpers (`field-path.ts`,
  `palette-entries.ts`) so they're unit-testable; the Lit component just renders. Edits/adds
  go through model ops → editor `#dispatch` (panel: `rime-doc-change`; palette: `rime-palette-add`
  → `editor.addBlock()`), so undo/redo + ARIA-live are covered.
- **Canvas DnD = custom pointer events** in the srcdoc iframe (OD-6), NOT a library; test
  with `page.mouse`.

## Commands
```bash
bun run test            # all unit tests (root, excludes e2e/spikes; uses --conditions=development)
bun run typecheck       # tsc across all packages
bun run lint            # oxlint
bun run format          # oxfmt --write   (format:check = CI gate)
bun run build           # build all packages
bun run size            # bundle-size gate (~100 kB gzip)
bun run e2e             # rime-core Playwright (chromium + webkit)
```
Fresh-clone CI check before pushing:
```bash
cd /tmp && rm -rf rime-x && git clone <repo-or-local-path> rime-x && cd rime-x \
  && git checkout <branch> && bun install --frozen-lockfile \
  && bun run test && bun run typecheck && bun run lint && bun run format:check \
  && bun run build && bun run size && bun run e2e
```
