# Enveloppe — Board

Tickets derived from [PRD.md](./PRD.md). Status columns: **Backlog → Ready → In Progress → Review → Done**.

Conventions:
- ID format `ENV-NN`. Each ticket links back to the PRD section it satisfies.
- `Spike` = time-boxed investigation that ends in a decision recorded in the PRD's "Open decisions" table.
- Priority: **P0** (blocks v1) · **P1** (needed for v1 done-bar) · **P2** (stretch/nice-to-have).

---

## Milestone 0 — Foundations & de-risking

> Resolve the two open decisions (OD-1 rich text, OD-2 toolchain) and stand up the monorepo before feature work.

| ID | Title | Pri | Depends on | PRD |
|----|-------|-----|------------|-----|
| ENV-01 | **Scaffold Bun-workspaces monorepo** — `packages/{doc-model,core,renderer-mjml,react,vue}`, `apps/demo`; root config | P0 | — | §8 |
| ENV-02 | **Toolchain spike** — oxlint + oxfmt; Vite lib mode; try `rolldown-vite` with Lit + CSS; set core **bundle-size budget**; fall back to stock Vite if Rolldown fights Lit. Record OD-2 + OD-4. | P0 | ENV-01 | §7, OD-2/4 |
| ENV-03 | **CI pipeline** — install, lint (oxlint), format check (oxfmt), unit (bun test), build, bundle-size gate | P0 | ENV-02 | §10 |
| ENV-04 | **Playwright harness** — cross-browser incl. WebKit/Safari; base fixtures for the editor | P0 | ENV-01 | §9 |
| ENV-05 | **Rich-text engine spike (OD-1)** — prototype Tiptap-core vs Lexical mounted in a Lit/iframe canvas; measure bundle, Safari/iOS behaviour, paste sanitization, JSON round-trip; **decide (default Tiptap)** | P0 | ENV-01 | §6.7, OD-1 |
| ENV-06 | **Repo hygiene** — README quickstart skeleton, CONTRIBUTING, CODE_OF_CONDUCT, issue/PR templates, MIT LICENSE confirmed | P1 | ENV-01 | §1 |

## Milestone 1 — Document model (headless core)

> The source of truth. Pure, framework-free, independently publishable.

| ID | Title | Pri | Depends on | PRD |
|----|-------|-----|------------|-----|
| ENV-10 | **Doc model schema** — JSON tree types (Section/Column/Text/Image/Button/Divider/Spacer), validation | P0 | ENV-01 | §6.1 |
| ENV-11 | **Immutable update + patch-diff engine** — apply edits as immutable transforms producing JSON patches | P0 | ENV-10 | §6.1 |
| ENV-12 | **Undo/redo** — capped history of patch diffs (not snapshots); memory-bounded | P0 | ENV-11 | §6.1, §10 |
| ENV-13 | **CRDT-friendly shape audit** — ensure node identity/ordering won't block a future Yjs layer (design only) | P1 | ENV-10 | §6.1 |
| ENV-14 | **Serialize/deserialize** — lossless JSON save/load round-trip + tests | P0 | ENV-10 | §6.10 |

## Milestone 2 — Export renderer (MJML)

> Independently publishable; off the in-browser hot path.

| ID | Title | Pri | Depends on | PRD |
|----|-------|-----|------------|-----|
| ENV-20 | **`Renderer` interface** — `render(doc) → email HTML`; swappable | P0 | ENV-10 | §6.3 |
| ENV-21 | **`MjmlRenderer`** — doc JSON → MJML → HTML for all core blocks | P0 | ENV-20 | §6.3 |
| ENV-22 | **Raw-table fallback path** — for blocks MJML can't express (OD-5) | P1 | ENV-21 | §6.3, OD-5 |
| ENV-23 | **Output-correctness fixtures** — render core blocks; verify Outlook/Gmail/Apple Mail (snapshot + manual matrix) | P0 | ENV-21 | §11 |

## Milestone 3 — Canvas & shell (Lit)

| ID | Title | Pri | Depends on | PRD |
|----|-------|-----|------------|-----|
| ENV-30 | **`<enveloppe-editor>` shell** — Lit component, layout regions (palette / canvas / properties) | P0 | ENV-02 | §6.5 |
| ENV-31 | **iframe canvas** — same-origin `srcdoc`, real preview DOM, injected base stylesheet | P0 | ENV-30 | §6.4 |
| ENV-32 | **Doc → canvas renderer** — render the JSON doc to the clean preview DOM (divs/flex) | P0 | ENV-31, ENV-10 | §6.2 |
| ENV-33 | **Coordinate-translation drag controller** — host pointer space ↔ iframe doc space (single owner) | P0 | ENV-31 | §6.4 |
| ENV-34 | **Two-surface theming** — `--eb-*` CSS custom properties for chrome; verify no host CSS bleed into canvas | P1 | ENV-30 | §6.5 |

## Milestone 4 — Drag & drop (the do-or-die)

| ID | Title | Pri | Depends on | PRD |
|----|-------|-----|------------|-----|
| ENV-40 | **Integrate Pragmatic DnD** — palette → canvas, reorder within/between columns, nested drop zones | P0 | ENV-32, ENV-33 | §6.6 |
| ENV-41 | **Drop-zone detection + indicators** — performant hit-testing, insertion markers | P0 | ENV-40 | §6.6 |
| ENV-42 | **DnD perf pass** — 60fps drag + bounded detection latency on the low-end reference machine; set ms budget (OD-3) | P0 | ENV-41 | §10, OD-3 |
| ENV-43 | **Custom drag preview** — styled to match builder design | P1 | ENV-40 | §6.6 |
| ENV-44 | **Keyboard reordering** — select block → move up/down/into via keyboard / "move to" menu | P0 | ENV-40 | §6.6 |
| ENV-45 | **ARIA live announcements** — move/insert/delete announced to screen readers | P0 | ENV-44 | §6.6 |
| ENV-46 | **Cross-browser DnD E2E** — Playwright incl. WebKit; touch path | P0 | ENV-41 | §9 |
| ENV-47 | **Memory-leak guard** — no leaked listeners/observers across drag ops (verified) | P0 | ENV-40 | §10 |

## Milestone 5 — Inline rich text

| ID | Title | Pri | Depends on | PRD |
|----|-------|-----|------------|-----|
| ENV-50 | **Integrate chosen engine** (per ENV-05) headless in the canvas | P0 | ENV-05, ENV-32 | §6.7 |
| ENV-51 | **One-instance lifecycle** — create on focus, destroy on blur; assert single live instance | P0 | ENV-50 | §6.7, §10 |
| ENV-52 | **Custom rich-text UI** — Lit inline toolbar / bubble menu / link popover, themed by `--eb-*` | P0 | ENV-50 | §6.5 |
| ENV-53 | **Schema ↔ doc-model round-trip** — text content serializes into/out of the JSON doc losslessly | P0 | ENV-50, ENV-14 | §6.1 |
| ENV-54 | **Paste sanitization** — Word/Outlook/Docs paste reduced to schema-valid content | P1 | ENV-50 | §6.7 |
| ENV-55 | **IME / mobile / Safari hardening** — verified | P1 | ENV-50 | §9 |

## Milestone 6 — Blocks & properties

| ID | Title | Pri | Depends on | PRD |
|----|-------|-----|------------|-----|
| ENV-60 | **Block registration interface** — `registerBlock({schema, renderCanvas, renderExport, palette})`; built-ins use same path | P0 | ENV-32, ENV-21 | §6.8 |
| ENV-61 | **Core blocks** — Section, Column(s), Text, Image, Button, Divider, Spacer | P0 | ENV-60 | §12 |
| ENV-62 | **Properties panel** — schema-driven forms (padding, colors, alignment, columns, etc.) | P0 | ENV-60 | §6.5 |
| ENV-63 | **Palette** — categorized, icons, drag source | P0 | ENV-60, ENV-40 | §6.5 |
| ENV-64 | **Example custom block** — documented end-to-end (the SDK proof) | P1 | ENV-60 | §12 |
| ENV-65 | **Social block** | P2 | ENV-61 | §12 |

## Milestone 7 — Personalization tokens

| ID | Title | Pri | Depends on | PRD |
|----|-------|-----|------------|-----|
| ENV-70 | **`{{variable}}` merge tags** in rich text + render handling | P1 | ENV-50 | §6.9 |
| ENV-71 | **Token picker UI** | P1 | ENV-70 | §6.9 |
| ENV-72 | **`registerToken` / token-source config** | P1 | ENV-70 | §6.8/9 |

## Milestone 8 — Persistence & images

| ID | Title | Pri | Depends on | PRD |
|----|-------|-----|------------|-----|
| ENV-80 | **JSON in/out API** — load(doc) / getDoc() / change events | P0 | ENV-14, ENV-30 | §6.10 |
| ENV-81 | **`onImageUpload` callback** — image block uses host-provided uploader | P1 | ENV-61 | §6.10 |

## Milestone 9 — Framework wrappers & demo

| ID | Title | Pri | Depends on | PRD |
|----|-------|-----|------------|-----|
| ENV-90 | **React wrapper** — props/events/ref over the web component | P1 | ENV-30 | §7 |
| ENV-91 | **Vue wrapper** — props/events/v-model over the web component | P1 | ENV-30 | §7 |
| ENV-92 | **Demo app** — local store, `onImageUpload` stub, theme showcase, proves end-user UX | P1 | ENV-61, ENV-80 | §4, §12 |
| ENV-93 | **Astro/vanilla usage example** in README | P2 | ENV-30 | §7 |

## Milestone 10 — Release readiness

| ID | Title | Pri | Depends on | PRD |
|----|-------|-----|------------|-----|
| ENV-100 | **<30-min embed test** — fresh dev follows README, embeds + themes + save/load; time it | P1 | ENV-90, ENV-92 | §11 |
| ENV-101 | **Perf gate sign-off** — §10 budgets met on low-end reference machine | P0 | ENV-42, ENV-47, ENV-51 | §10 |
| ENV-102 | **Output-correctness sign-off** — email-client matrix passes | P0 | ENV-23 | §11 |
| ENV-103 | **Docs site / API reference** — `init` config, `registerBlock`, `registerToken`, theming tokens | P1 | ENV-60, ENV-72 | §1 |
| ENV-104 | **npm publish** `@enveloppe/*` (core, doc-model, renderer-mjml, react, vue) | P1 | ENV-100..103 | §8 |

---

## Notes
- **Critical path to a usable demo:** ENV-01 → ENV-10/11 → ENV-30/31/32 → ENV-40/41 → ENV-50 → ENV-60/61 → ENV-21 → ENV-92.
- **Highest-risk tickets:** ENV-05 (rich-text engine, OD-1), ENV-42 (DnD perf), ENV-02 (toolchain, OD-2). Do these early.
- Tickets here are intentionally coarse; split into sub-issues when pulled into "In Progress".
