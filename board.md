# Rime — Board

Tickets derived from [PRD.md](./PRD.md). Status: **⬜ Ready → ✅ Done**.
Ticket frontmatter `status:` is the source of truth; this board is the rollup.

**Progress: 27 / 52 tickets done.** Milestones 0–4 complete; Milestone 5 (inline
rich text) in progress — ENV-27 done (headless Lexical mounted in-iframe,
core measured 50.58 kB gzip vs ~100 kB budget).

| Milestone | Done |
|-----------|------|
| 0 — Foundations & de-risking | ✅ 4 / 4 |
| 1 — Document model | ✅ 5 / 5 |
| 2 — Export renderer (MJML) | ✅ 4 / 4 |
| 3 — Canvas & shell | ✅ 5 / 5 |
| 4 — Drag & drop | ✅ 8 / 8 |
| 5 — Inline rich text | 🔶 1 / 6 |
| 6 — Blocks & properties | ⬜ 0 / 6 |
| 7 — Personalization tokens | ⬜ 0 / 3 |
| 8 — Persistence & images | ⬜ 0 / 2 |
| 9 — Framework wrappers & demo | ⬜ 0 / 4 |
| 10 — Release readiness | ⬜ 0 / 5 |

Conventions:
- ID format `ENV-NN`. Each ticket links back to the PRD section it satisfies.
- `Spike` = time-boxed investigation that ends in a decision recorded in the PRD's "Open decisions" table.
- Priority: **P0** (blocks v1) · **P1** (needed for v1 done-bar) · **P2** (stretch/nice-to-have).

---

## Milestone 0 — Foundations & de-risking ✅

> Resolve the open decisions (OD-1 rich text, OD-2 toolchain, OD-3 DnD perf, OD-4 budget, OD-6 canvas DnD engine) and stand up the monorepo before feature work.

| ID | St | Title | Pri | Depends on | PRD |
|----|----|-------|-----|------------|-----|
| ENV-01 | ✅ | **Scaffold Bun-workspaces monorepo** — `packages/{doc-model,core,renderer-mjml,react,vue}`, `apps/demo`; root config | P0 | — | §8 |
| ~~OD-2~~ | ✅ | **DONE (spike)** — Toolchain → **rolldown-vite** builds + runs Lit/CSS/iframe (Chromium + WebKit); oxlint/oxfmt Lit-safe; size gate prototyped. Stock Vite = fallback. See `.claude/spikes/od2-toolchain/FINDINGS.md`. | P0 | ENV-01 | §7, OD-2 |
| ENV-02 | ✅ | **CI pipeline** — install, lint (oxlint), format check (oxfmt), unit (bun test), build, bundle-size gate | P0 | ENV-01 | §10 |
| ENV-03 | ✅ | **Playwright harness** — cross-browser incl. WebKit/Safari; base fixtures for the editor | P0 | ENV-01 | §9 |
| ~~OD-1~~ | ✅ | **DONE (spike)** — Rich-text engine → **Lexical** (see OD-4). See `.claude/spikes/od1-richtext/FINDINGS.md`. | P0 | ENV-01 | §6.7, OD-1 |
| ENV-04 | ✅ | **Repo hygiene** — README quickstart, CONTRIBUTING, CODE_OF_CONDUCT, issue/PR templates (+ DCO), MIT LICENSE confirmed | P1 | ENV-01 | §1 |

## Milestone 1 — Document model (headless core) ✅

> The source of truth. Pure, framework-free, independently publishable.

| ID | St | Title | Pri | Depends on | PRD |
|----|----|-------|-----|------------|-----|
| ENV-05 | ✅ | **Doc model schema** — JSON tree types (Section/Column/Text/Image/Button/Divider/Spacer), validation | P0 | ENV-01 | §6.1 |
| ENV-06 | ✅ | **Immutable update + patch-diff engine** — apply edits as immutable transforms producing JSON patches | P0 | ENV-05 | §6.1 |
| ENV-07 | ✅ | **Undo/redo** — capped history of patch diffs (not snapshots); memory-bounded | P0 | ENV-06 | §6.1, §10 |
| ENV-08 | ✅ | **CRDT-friendly shape audit** — ensure node identity/ordering won't block a future Yjs layer (design only) | P1 | ENV-05 | §6.1 |
| ENV-09 | ✅ | **Serialize/deserialize** — lossless JSON save/load round-trip + tests | P0 | ENV-05 | §6.10 |

## Milestone 2 — Export renderer (MJML) ✅

> Independently publishable; off the in-browser hot path.

| ID | St | Title | Pri | Depends on | PRD |
|----|----|-------|-----|------------|-----|
| ENV-10 | ✅ | **`Renderer` interface** — `render(doc) → email HTML`; swappable | P0 | ENV-05 | §6.3 |
| ENV-11 | ✅ | **`MjmlRenderer`** — doc JSON → MJML → HTML for all core blocks | P0 | ENV-10 | §6.3 |
| ENV-12 | ✅ | **Raw-table fallback path** — for blocks MJML can't express (OD-5) | P1 | ENV-11 | §6.3, OD-5 |
| ENV-13 | ✅ | **Output-correctness fixtures** — render core blocks; golden snapshots + manual Outlook/Gmail/Apple Mail matrix | P0 | ENV-11 | §11 |

## Milestone 3 — Canvas & shell (Lit) ✅

| ID | St | Title | Pri | Depends on | PRD |
|----|----|-------|-----|------------|-----|
| ENV-14 | ✅ | **`<rime-editor>` shell** — Lit component, layout regions (palette / canvas / properties) | P0 | ENV-01 | §6.5 |
| ENV-15 | ✅ | **iframe canvas** — same-origin `srcdoc`, real preview DOM, injected base stylesheet | P0 | ENV-14 | §6.4 |
| ENV-16 | ✅ | **Doc → canvas renderer** — render the JSON doc to the clean preview DOM (divs/flex) | P0 | ENV-15, ENV-05 | §6.2 |
| ENV-17 | ✅ | **Coordinate-translation drag controller** — host pointer space ↔ iframe doc space (single owner) | P0 | ENV-15 | §6.4 |
| ENV-18 | ✅ | **Two-surface theming** — `--eb-*` CSS custom properties for chrome; verify no host CSS bleed into canvas | P1 | ENV-14 | §6.5 |

## Milestone 4 — Drag & drop (the do-or-die) ✅

> **OD-6 (resolved):** Pragmatic DnD dropped — it binds to the host `document` + native HTML5 drag, which the srcdoc iframe canvas defeats. Canvas DnD is **custom pointer-event** dragging via the ENV-17 coordinate controller.

| ID | St | Title | Pri | Depends on | PRD |
|----|----|-------|-----|------------|-----|
| ENV-19 | ✅ | **Canvas DnD (pointer events, OD-6)** — palette → canvas, reorder within/between columns, nested drop zones | P0 | ENV-16, ENV-17 | §6.6 |
| ENV-20 | ✅ | **Drop-zone detection + indicators** — rAF-gated hit-testing, themed insertion marker | P0 | ENV-19 | §6.6 |
| ENV-21 | ✅ | **DnD perf pass (OD-3 resolved)** — ≥95% frames ≤16.6ms + detection p95 ≤8ms under 4× CPU throttle; benchmark gates it | P0 | ENV-20 | §10, OD-3 |
| ENV-22 | ✅ | **Custom drag preview** — branded, `--eb-*`-themed, pointer-following | P1 | ENV-19 | §6.6 |
| ENV-23 | ✅ | **Keyboard reordering** — select block → move up/down/into via keyboard / "move to" menu | P0 | ENV-19 | §6.6 |
| ENV-24 | ✅ | **ARIA live announcements** — move/insert/delete announced to screen readers | P0 | ENV-23 | §6.6 |
| ENV-25 | ✅ | **Cross-browser DnD E2E** — Playwright incl. WebKit; touch path | P0 | ENV-20 | §9 |
| ENV-26 | ✅ | **Memory-leak guard** — no leaked listeners/observers/rAF across drag ops (verified) | P0 | ENV-19 | §10 |

## Milestone 5 — Inline rich text 🔶

| ID | St | Title | Pri | Depends on | PRD |
|----|----|-------|-----|------------|-----|
| ENV-27 | ✅ | **Integrate Lexical headless in the canvas** (per OD-1/OD-4) + **hard-confirm bundle budget**: measure real `@nord-forge/rime-core` gzip. Start from `.claude/spikes/od1-richtext/src/lexical-adapter.ts` (registerRichText + curated nodes). | P0 | OD-4, ENV-16 | §6.7, OD-1/4 |
| ENV-28 | ⬜ | **One-instance lifecycle** — create on focus, destroy on blur; assert single live instance | P0 | ENV-27 | §6.7, §10 |
| ENV-29 | ⬜ | **Custom rich-text UI** — Lit inline toolbar / bubble menu / link popover, themed by `--eb-*` | P0 | ENV-27 | §6.5 |
| ENV-30 | ⬜ | **Schema ↔ doc-model round-trip** — text content serializes into/out of the JSON doc losslessly | P0 | ENV-27, ENV-09 | §6.1 |
| ENV-31 | ⬜ | **Paste sanitization** — Word/Outlook/Docs paste → schema-valid content. **De-risked:** spike proved Lexical's `registerRichText` + curated node set sanitizes mso/font/script (Chromium + WebKit). This ticket = port + harden. | P1 | ENV-27 | §6.7 |
| ENV-32 | ⬜ | **IME / mobile / Safari hardening** — verified (real iOS Safari + CJK IME manual pass; not covered by automated WebKit) | P1 | ENV-27 | §9 |

## Milestone 6 — Blocks & properties ⬜

| ID | St | Title | Pri | Depends on | PRD |
|----|----|-------|-----|------------|-----|
| ENV-33 | ⬜ | **Block registration interface** — `registerBlock({schema, renderCanvas, renderExport, palette})`; built-ins use same path | P0 | ENV-16, ENV-11 | §6.8 |
| ENV-34 | ⬜ | **Core blocks** — Section, Column(s), Text, Image, Button, Divider, Spacer | P0 | ENV-33 | §12 |
| ENV-35 | ⬜ | **Properties panel** — schema-driven forms (padding, colors, alignment, columns, etc.) | P0 | ENV-33 | §6.5 |
| ENV-36 | ⬜ | **Palette** — categorized, icons, drag source | P0 | ENV-33, ENV-19 | §6.5 |
| ENV-37 | ⬜ | **Example custom block** — documented end-to-end (the SDK proof) | P1 | ENV-33 | §12 |
| ENV-38 | ⬜ | **Social block** | P2 | ENV-34 | §12 |

## Milestone 7 — Personalization tokens ⬜

| ID | St | Title | Pri | Depends on | PRD |
|----|----|-------|-----|------------|-----|
| ENV-39 | ⬜ | **`{{variable}}` merge tags** in rich text + render handling | P1 | ENV-27 | §6.9 |
| ENV-40 | ⬜ | **Token picker UI** | P1 | ENV-39 | §6.9 |
| ENV-41 | ⬜ | **`registerToken` / token-source config** | P1 | ENV-39 | §6.8/9 |

## Milestone 8 — Persistence & images ⬜

| ID | St | Title | Pri | Depends on | PRD |
|----|----|-------|-----|------------|-----|
| ENV-42 | ⬜ | **JSON in/out API** — load(doc) / getDoc() / change events | P0 | ENV-09, ENV-14 | §6.10 |
| ENV-43 | ⬜ | **`onImageUpload` callback** — image block uses host-provided uploader | P1 | ENV-34 | §6.10 |

## Milestone 9 — Framework wrappers & demo ⬜

| ID | St | Title | Pri | Depends on | PRD |
|----|----|-------|-----|------------|-----|
| ENV-44 | ⬜ | **React wrapper** — props/events/ref over the web component | P1 | ENV-14 | §7 |
| ENV-45 | ⬜ | **Vue wrapper** — props/events/v-model over the web component | P1 | ENV-14 | §7 |
| ENV-46 | ⬜ | **Demo app** — local store, `onImageUpload` stub, theme showcase, proves end-user UX | P1 | ENV-34, ENV-42 | §4, §12 |
| ENV-47 | ⬜ | **Astro/vanilla usage example** in README | P2 | ENV-14 | §7 |

## Milestone 10 — Release readiness ⬜

| ID | St | Title | Pri | Depends on | PRD |
|----|----|-------|-----|------------|-----|
| ENV-48 | ⬜ | **<30-min embed test** — fresh dev follows README, embeds + themes + save/load; time it | P1 | ENV-44, ENV-46 | §11 |
| ENV-49 | ⬜ | **Perf gate sign-off** — §10 budgets met on low-end reference machine | P0 | ENV-21, ENV-26, ENV-28 | §10 |
| ENV-50 | ⬜ | **Output-correctness sign-off** — email-client matrix passes | P0 | ENV-13 | §11 |
| ENV-51 | ⬜ | **Docs site / API reference** — `init` config, `registerBlock`, `registerToken`, theming tokens | P1 | ENV-33, ENV-41 | §1 |
| ENV-52 | ⬜ | **npm publish** `@nord-forge/*` (core, doc-model, renderer-mjml, react, vue) | P1 | ENV-48, ENV-49, ENV-50, ENV-51 | §8 |

---

## Notes
- **Detailed, agent-ready tickets** live in [`.claude/tickets/`](./.claude/tickets/),
  grouped into per-milestone subfolders (`00-foundations/` … `10-release/`), one
  self-contained `ENV-NN-slug.md` each (read `_conventions.md` first). IDs are
  contiguous `ENV-01`…`ENV-52`. Ticket frontmatter `status:` is the source of
  truth; this board is the rollup.
- **Critical path to a usable demo:** ENV-01 → ENV-05/06 → ENV-14/15/16 → ENV-19/20 → ENV-27 → ENV-33/34 → ENV-11 → ENV-46. (Through ENV-27 is done; ENV-33/34 is the next critical-path item.)
- **Highest-risk remaining tickets:** ENV-27/32 (Lexical integration + Safari/IME, elevated R-1). Do/verify these carefully.
- **Resolved decisions:** OD-1 (engine→Lexical), OD-2 (toolchain→rolldown-vite), OD-3 (DnD perf budget), OD-4 (core budget ~100 kB), OD-5 (raw-table fallback), OD-6 (canvas DnD→custom pointer events). See PRD "Open decisions".
- Done spikes (not tickets): OD-2 (toolchain), OD-1/OD-4 (engine→Lexical, budget).
