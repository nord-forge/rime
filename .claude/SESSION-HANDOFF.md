# Session handoff — Rime

Snapshot to continue work in a fresh session. Update or delete when stale.
Last updated after PR #12 merged. Branch: `main` (clean).

## What this project is
**Rime** — an embeddable, framework-agnostic email template builder. Published under
the **`@nord-forge`** npm scope (NOT `@enveloppe` — that name is gone). Repo:
`github.com/nord-forge/rime`. Packages:
`@nord-forge/rime-{core,model,mjml,react,vue}` + `apps/rime-demo`. Stack: Bun, Lit,
Lexical (headless rich text), MJML export, TypeScript strict, oxlint/oxfmt, Playwright.

## Progress (board is source of truth: `board.md`)
- **37/61 tickets done.**
- **Milestones 0–5 complete.** Milestone 6 (blocks & properties) in progress: **5/15**
  — ENV-33 (registerBlock interface), ENV-34 (seven core blocks), ENV-65 (schema
  field types + open validator), ENV-57 (Heading), ENV-58 (Quote) done.
- Heading + Quote (PR #12) are the first of Batch A. They're custom leaf blocks:
  node interface declared in rime-core (NOT the rime-model union), validated via
  `validateDoc`'s `extraLeafTypes`, exported as native `<mj-text>`. They go in the
  core set (`registerCoreBlocks`). Pattern to copy for the rest of the catalog.
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
  ~71.9 kB.
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
- **Open validator:** `validateDoc(doc, { extraLeafTypes })` accepts registered custom
  leaf types (validates id + BlockStyle generically; block schema validates the rest).
  Doc-model stays headless — it never imports the registry. New blocks add their type
  here, NOT by editing the doc-model node union.
- **Section is a styled container:** full-bleed background + padding wrapping its
  column(s) and blocks; a new Section defaults to one 100% column. (User requirement.)
- **Rich text:** Lexical headless, ONE live instance (create-on-focus/destroy-on-blur
  via `RichTextLifecycle`); lossless `RichTextJSON`↔Lexical round-trip in
  `richtext/serialize/serialize.ts`; custom `<eb-rich-text-toolbar>` + `<eb-link-popover>`
  (NO library UI); paste sanitization = curated node set + link-href guard; IME
  composition guard defers blur mid-composition.
- **Canvas DnD = custom pointer events** in the srcdoc iframe (OD-6), NOT a library;
  test with `page.mouse`.

## NEXT UP — the remaining block catalog (Milestone 6)
The block catalog was expanded (PR #8). Tickets in `.claude/tickets/06-blocks-properties/`.
Build each as a `BlockDefinition`, register via `registerBlock`, add canvas + MJML export,
extend `validateDoc` use via `extraLeafTypes`. Suggested batching:

**Batch A — simple P1 (MJML-native, no schema-gap deps):**
- ✅ ENV-57 Heading (`<mj-text>` h1–3), ✅ ENV-58 Quote (`<mj-text>` blockquote) — done (PR #12).
- REMAINING: ENV-38 Social (`<mj-social>`), ENV-60 Hero (`<mj-hero>` bg+text+CTA),
  ENV-61 Column presets (Section+Column subtrees — palette presets that drop a subtree;
  note the design wrinkle: a PaletteEntry that yields a subtree, not a single leaf).

**Batch B — list/multiline-dependent (use ENV-65's new field types):**
- ENV-59 Menu (`<mj-navbar>`, items list), ENV-62 HTML (`<mj-raw>` passthrough, `code`
  field, trusted/un-sanitized), ENV-63 Video (poster + play overlay → link),
  ENV-64 Table (raw-table fallback, the one block where `<table>` is allowed on canvas).

Reuse the href normalizer (`richtext/ui/rich-text-commands.ts` `normalizeHref`) for any
href field (reject `javascript:`). Each new block: register in `defineRimeEditor`'s core
set or as its own definition; add a palette entry; add unit tests (canvas DOM + MJML
parity where it maps to a native component).

After batch(es): ENV-35 (properties panel — schema-driven forms, consumes the schema DSL
incl. new field types), ENV-36 (palette UI, drag source), ENV-37 (example custom block —
the SDK proof). These unblock the demo (ENV-46).

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
