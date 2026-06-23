# Enveloppe — Product Requirements Document

> An open-source, framework-agnostic email template builder.
> The look-and-feel of Unlayer, the clean editing of Tiptap, the drag-and-drop power of GrapesJS — without the ugly UI, and without the closed source.

- **Status:** Draft v0.1 (pre-implementation)
- **Last updated:** 2026-06-22
- **License:** MIT
- **Package scope:** `@enveloppe/*` · **Custom element:** `<enveloppe-editor>`
- **Repo:** `~/Documents/open-source/enveloppe`

---

## 1. Why this exists

There is a real gap in the developer landscape: there is **no great open-source email template builder**. The good ones (Unlayer, Stripo, Beefree) are closed/commercial. The open one (GrapesJS) is powerful but visually unpolished and not purpose-built for email. Developers who want to embed an email builder in their own product currently must either pay per-seat for a SaaS widget or bolt together GrapesJS and fight its UI.

Enveloppe closes that gap: a **beautiful, framework-agnostic, embeddable** email builder that developers can drop into Astro/JS, React, and Vue apps, theme to match their product, and extend with custom blocks — released under MIT for the whole ecosystem.

## 2. Vision

> "Open-source Unlayer with a cleaner skin" — a single, polished WYSIWYG canvas where you drag blocks to build an email and edit rich text inline, that compiles to bulletproof email HTML, and that any developer can embed and theme in under 30 minutes.

## 3. Goals & non-goals

### Goals (v1)
- A polished, neutral-by-default, fully themeable email builder shipped as **web components** (Lit) with **React and Vue wrappers**.
- A single unified editing canvas (drag-and-drop + inline rich text + properties panel) — the proven Unlayer interaction model, with a cleaner skin.
- Compile to **bulletproof, Outlook-safe email HTML** via MJML.
- Extensible: developers register **custom blocks** and **custom merge tokens** at init.
- Headless persistence: the library emits/consumes JSON and delegates storage and uploads to the host app.
- Excellent cross-browser behaviour, with explicit hardening for Safari/iOS.
- Performant on low-end hardware — smooth drag, bounded drop-detection latency, capped memory.

### Non-goals (v1)
- No real-time collaboration (the doc model is designed CRDT-friendly so this can be added later without a rewrite).
- No conditional logic / loops in personalization (basic `{{variable}}` merge tags only).
- No bundled backend / hosting service (the demo app uses a trivial local store).
- No "Fill" (locked content-only) mode — that is **v2**, built on the same doc model.
- No legacy browser support (no IE; evergreen only). Note: this is the **editor's** support floor — the **exported email** still targets legacy clients (Outlook) via MJML.

## 4. Target users & personas

**Primary (decisions favour this persona): developers embedding the builder.**
The customer is the integrator who drops `<enveloppe-editor>` into their SaaS/app so *their* users design emails. When priorities conflict, DX, theming, framework wrappers, and the extension APIs win.

**Secondary: the end-users** (marketers/creators) who use the builder inside the integrator's product. The out-of-the-box experience must be excellent by default — the demo app exists to prove this.

> Positioning: **library-first, UX-excellent-by-default.** v1 ships the embeddable library *and* a demo app that showcases the end-user experience.

## 5. The "dual-style editor", clarified

The original brief described a "dual-style editor" combining drag-and-drop building with Tiptap-clean editing. There is a critical architectural truth here:

- **There is ONE document model** (a clean JSON tree). It is the single source of truth.
- **v1 = a single unified canvas.** Drag blocks from a palette onto the tree; click any text block to edit rich text *inline* on the canvas; edit structural properties in a right-hand panel. This is the Unlayer model. The rich-text engine never owns layout — it only edits the text content of leaf nodes.
- **v2 = "Fill" mode.** The *same* doc model, rendered with structure locked, so end-users edit only unlocked text/image content and cannot break the layout. This is the "fill it in cleanly" half of the dual-style vision, delivered as a mode rather than a second editor.

This resolves the apparent contradiction between "exactly Unlayer's feel" (one canvas) and "a separate clean fill-in step" (a locked mode), without two competing document models.

## 6. Architecture

### 6.1 Document model (source of truth)
- A clean, framework-independent **JSON tree** of blocks (e.g. `Section → Column → TextBlock/ImageBlock/ButtonBlock/…`).
- **Immutable**; every edit produces a new doc.
- **Undo/redo via patch diffs** (JSON-patch-style), not full snapshots — bounded, capped history depth, memory-lean (a hard requirement for low-end hardware).
- **CRDT-friendly** shape so a Yjs layer can slot in later for collaboration without a rewrite. (Collab itself is out of scope for v1.)
- Round-trips losslessly to/from JSON for save/load.

### 6.2 Rendering — two distinct render targets
1. **Canvas preview DOM** (what the user sees while editing): a clean, modern DOM (divs/flex) rendered inside an iframe. Optimised for editing and hit-testing, **not** for email-client compatibility.
2. **Export HTML** (what gets sent): produced on save/export, **not** on the drag hot path.

### 6.3 Export renderer
- A swappable **`Renderer` interface**: `render(doc) → email HTML`.
- v1 default implementation: **`MjmlRenderer`** — maps the doc JSON to MJML, compiles MJML to bulletproof, Outlook-safe HTML. Inherits MJML's battle-tested handling of `mso` conditionals, VML buttons, ghost tables, etc.
- The interface keeps a future hand-rolled renderer a **non-breaking swap**, not a rewrite.
- Blocks MJML cannot express map to an author-provided raw-table fallback in the renderer (bounded, per-block).
- **Rationale:** the export renderer is *not* on the in-browser performance hot path (it runs at export), so choosing MJML costs nothing where performance matters and saves re-solving every email-client quirk.

### 6.4 Canvas
- A **same-origin `srcdoc` iframe** rendering the real preview DOM.
- Why iframe (not shadow-DOM-only): a true separate document gives a clean coordinate system for hit-testing (`elementFromPoint` is iframe-local, no host interference), and makes CSS bleed from the host app **physically impossible** — essential for truthful email preview. This is what every serious email builder (Unlayer, GrapesJS, Stripo) does.
- Memory scales with DOM node count identically in iframe vs shadow DOM; an email is small (hundreds–low thousands of nodes). The memory risk is leaked listeners/observers and undo snapshots — addressed by engineering discipline, not by the canvas container choice.
- **One drag controller** owns coordinate translation between the host pointer space and the iframe document space.

### 6.5 UI layer (Lit web components)
- Builder **chrome** (palette, properties panel, toolbars, menus) = **Lit web components with Shadow DOM**, living in the host document.
- **Two-surface theming model:**
  - *Chrome* is themed via **CSS custom properties** (`--eb-*`, e.g. `--eb-color-accent`, `--eb-radius`, `--eb-font-ui`) that intentionally pierce shadow boundaries. Host app CSS cannot otherwise break the chrome.
  - *Canvas* (iframe) is styled by an **injected base stylesheet** — these are the *email's* styles, deliberately walled off from both the host app and the chrome theme by the iframe boundary.
- All rich-text UI (inline toolbar, bubble menu, link popover, slash/insert menu) is **100% custom-rendered** as Lit components themed by the same `--eb-*` variables, so the editing experience matches the builder design exactly. The rich-text engine is used **headless** (no library-shipped toolbar).

### 6.6 Drag-and-drop engine
- **Canvas DnD = custom pointer-event handling inside the iframe** (OD-6, resolved 2026-06-23). Pragmatic drag-and-drop was the initial choice but binds to the host `document` and uses native HTML5 drag, which the same-origin srcdoc iframe canvas (§6.4) defeats; we use `pointerdown/move/up` via the single drag controller (§6.4) instead. Still purpose-built for **nested drop zones** (sections → columns → blocks), with touch support and a custom drag-preview — just hand-rolled on pointer events rather than a library, which the iframe's clean coordinate system makes straightforward.
- **Accessibility is owned by Enveloppe regardless of engine:** a parallel keyboard-reordering path (select block → move up/down/into via keyboard or a "move to" menu) and **ARIA live-region announcements** ("Moved Button to Column 2, position 1 of 3"). Screen-reader/keyboard users cannot drag; this parallel input model is mandatory, not optional.
- Drop-zone **detection logic** is the stated do-or-die: it must be performant (throttled / `requestAnimationFrame`-disciplined hit-testing) and consistent across browsers and hardware tiers.

### 6.7 Rich-text editing (inline)
- A **headless, framework-agnostic** rich-text engine mounted on a plain DOM node inside the iframe canvas.
- **Lifecycle for memory:** exactly **one editor instance alive at a time** — created when a text block is focused, destroyed on blur — regardless of how many text blocks the email contains.
- Engine candidates (both framework-agnostic, MIT, headless UI):
  - **Tiptap / ProseMirror** — most mature; **strict schema** auto-sanitizes pasted content (Word/Outlook garbage) into the doc model; strongest cross-browser/IME/Safari track record; matches the original "Tiptap feel" inspiration.
  - **Lexical** (Meta) — perf-first, smaller bundle, gentler API; younger, less battle-tested for IME/Safari.
  - **Slate is rejected** — its rendering layer requires React.
- **DECIDED (OD-1, updated 2026-06-22): Lexical (presumptive), hard-confirmed at ENV-27.** The decision history: the spike (`.claude/spikes/od1-richtext/FINDINGS.md`) first chose **Tiptap** on ergonomics/default-correctness — paste sanitization, synchronous `getJSON()`, undo, and commands work out of the box, whereas Lexical needs explicit wiring (`registerRichText`, `{discrete:true}` updates, curated nodes). Both are framework-agnostic (no React/Vue). Follow-up research proved Lexical reaches **full paste-sanitization parity** once wired (a wiring gap, not a capability gap). OD-4 then proved the **bundle gap is structural and permanent**: Tiptap's rich text is ~128 kB gzip (the ProseMirror floor; curation can't get below ~108 kB), vs Lexical wired at ~43 kB — a ~3× / ~85 kB gap.
  - **OD-4 set the core budget at ~100 kB gzip (best-in-class lean, potato-PC-first).** Tiptap's rich text *alone* (~128 kB) **exceeds the entire core budget**, with no curation path back — so **OD-1 flips to Lexical.** Tiptap's ergonomics edge does not survive the budget constraint, and the project's stated in-browser/memory constraint is the tie-breaking value here.
  - **Presumptive, not yet coded:** per the ENV-27 deferral, the Lexical integration is built and the choice formally re-confirmed against *measured* (not estimated) non-engine core weight. Tiptap is revived only if the ~100 kB budget is later raised. The wired Lexical adapter in `.claude/spikes/od1-richtext/src/lexical-adapter.ts` is the starting point.
- Either way, all visible UI is custom (see 6.5).

### 6.8 Extensibility API
- `init(config)` accepts **JSON** for declarative concerns: theme tokens, enabled blocks, defaults, base styles, token sources.
- **`registerBlock({ schema, renderCanvas, renderExport, palette })`** for custom blocks. A block declares:
  1. **schema** — its props/settings (drives the properties-panel form),
  2. **renderCanvas** — how it draws in the preview iframe (WYSIWYG),
  3. **renderExport** — how it compiles to email HTML (MJML mapping or raw-table fallback),
  4. **palette** — icon, label, category, default props.
  Built-in blocks use this **same** interface — no special-case path.
- **`registerToken` / token-source config** — integrators declare their own merge-tag set (`{{first_name}}`, …), consistent with the `registerBlock` philosophy.
- Rationale for hybrid (JSON + registry): render and export are **functions**, not data, so custom blocks cannot be pure JSON; declarative where possible, functions where required.

### 6.9 Personalization tokens (v1)
- Insert `{{variable}}` merge tags inline; a token-picker UI.
- Custom token registration via `registerToken`.
- **No** conditional blocks, loops, or repeaters in v1.

### 6.10 Persistence (headless)
- Core is backend-free. The library **emits and accepts JSON** (the doc model).
- Image upload via a host-provided **`onImageUpload`** callback — the integrator wires their own storage/CDN.
- The demo app uses a trivial local store to be runnable out of the box.

## 7. Tech stack

| Concern | Choice |
|---|---|
| Component model | **Lit** web components (+ thin React & Vue wrappers; more frameworks later) |
| Canvas | same-origin `srcdoc` **iframe**, real preview DOM |
| Drag & drop | **Pragmatic drag-and-drop** + custom keyboard/ARIA a11y layer |
| Rich text | headless **Lexical** (presumptive, confirm at ENV-27; chosen for ~100 kB budget), custom UI |
| Export | **MJML** via swappable `Renderer` interface |
| Doc model | immutable **JSON tree**, patch-diff undo, CRDT-friendly |
| Theming | **CSS custom properties** (`--eb-*`) for chrome; injected stylesheet for canvas |
| Lint / format | **oxlint + oxfmt** |
| Bundling | **Vite** library mode (opt into **`rolldown-vite`** where stable) |
| PM / runtime / unit test | **Bun** |
| Browser E2E / cross-browser | **Playwright** (incl. Safari/WebKit) |
| Monorepo | **Bun workspaces** |
| License | **MIT** |

## 8. Repository structure

```
enveloppe/
├── packages/
│   ├── doc-model/        # headless JSON doc model, patch/undo, schema, validation
│   ├── core/             # Lit <enveloppe-editor> web component (canvas, chrome, DnD, rich text)
│   ├── renderer-mjml/    # default Renderer impl (doc JSON → MJML → email HTML)
│   ├── react/            # thin React wrapper
│   └── vue/              # thin Vue wrapper
├── apps/
│   └── demo/             # runnable demo app (local store, onImageUpload stub)
├── PRD.md
├── board.md
├── README.md
└── LICENSE
```
> `doc-model` and `renderer-mjml` are independently publishable so the doc model and export can be used headless/server-side without the editor.

## 9. Browser support

- **Editor:** evergreen, last 2 versions of Chrome, Edge, Firefox, Safari. Native web components, no legacy/IE, no polyfill burden.
- **Explicit extra QA budget for Safari/iOS** — most web-component + iframe + pointer-event + contenteditable quirks live there.
- **Exported email:** targets the full email-client matrix (incl. Windows Outlook) via MJML.

## 10. Performance requirements (hard gates for release)

These are release gates, measured on a **low-end ("potato PC") reference machine** as well as a high-end one:
- **Drag at ~60fps** — no visible jank while dragging a block over a realistic newsletter.
- **Bounded drop-detection latency** — hit-testing/drop-zone detection stays within a defined per-frame budget (target: well under one frame at 60fps; exact ms budget set during the DnD-perf ticket).
- **Capped memory** — at most one live rich-text instance; patch-based (not snapshot) undo; no leaked listeners/observers across drag operations (verified).
- **Bundle size budget** — `@enveloppe/core` ≤ **~100 kB gzip** (editor only; MJML renderer excluded). Set by OD-4; enforced in CI via `measure.ts`. This budget drove the Lexical engine choice (OD-1).

## 11. Success metrics

**Primary — developer adoption & DX:**
- A developer can embed `<enveloppe-editor>`, theme it, and save/load a template in **< 30 minutes** from the README.
- GitHub stars / npm installs / real projects integrating it.

**Hard release gates (must pass before any release, regardless of DX):**
- **Output correctness** — generated emails render correctly across the major clients, including Windows Outlook, Gmail, Apple Mail (verified against a fixture set).
- **Performance budgets** in §10 met on the low-end reference machine.

## 12. v1 "done" bar (release scope)

- Single unified canvas with core blocks: **Section, Column(s), Text, Image, Button, Divider, Spacer** (plus Social as stretch).
- **Inline rich-text** editing with custom UI.
- **Properties panel** for structural/style editing.
- **MJML export** + **JSON save/load**.
- **Theming** via CSS custom properties.
- **React and Vue wrappers** + the Lit web component.
- **`registerBlock` SDK** documented, with **one example custom block**.
- **`registerToken`** + basic `{{variable}}` merge tags + token picker.
- Headless persistence (`onImageUpload` callback; demo uses local store).
- **Demo app** proving the end-user experience.
- A11y: keyboard reordering + ARIA live announcements.
- Performance gates (§10) met; cross-browser incl. Safari verified via Playwright.

## 13. Roadmap beyond v1

- **v2:** "Fill" mode (locked, content-only editing on the same doc model).
- Real-time collaboration (Yjs layer on the CRDT-friendly doc).
- Conditional blocks / loops / repeaters in personalization.
- Additional framework wrappers (Svelte, Angular, Solid).
- Optional hand-rolled (non-MJML) renderer behind the same interface.
- Template gallery / starter templates.

## 14. Open decisions & risks

| # | Item | Status / mitigation |
|---|---|---|
| OD-1 | **Rich-text engine** (Tiptap vs Lexical) | ✅ **RESOLVED 2026-06-22 → Lexical (presumptive), confirm at ENV-27.** Initially Tiptap on ergonomics, but the ~100 kB OD-4 budget (below) is exceeded by Tiptap's rich text alone (~128 kB) — flips to Lexical (~43 kB wired, paste parity proven). Hard-confirm against measured core weight at ENV-27. See `.claude/spikes/od1-richtext/FINDINGS.md` + `ENV-56-FINDINGS.md`. |
| OD-2 | **Build toolchain** (rolldown-vite + Lit + CSS) stability | ✅ **RESOLVED 2026-06-22 → rolldown-vite.** Spike (`.claude/spikes/od2-toolchain/FINDINGS.md`) proved it builds AND runs a Lit + `css\`\`` + CSS-vars + iframe component, identical to stock Vite, passing browser smoke in Chromium + WebKit. oxlint/oxfmt confirmed Lit-safe. Stock Vite kept as drop-in fallback. Size gate (`measure.ts`) prototyped for OD-4. |
| OD-3 | Exact **drop-detection latency budget** (ms) | ✅ **RESOLVED 2026-06-23 → drop-detection p95 ≤ 8 ms/frame (half a 16.6 ms frame) + ≥ 95% of drag frames ≤ 16.6 ms (~60fps).** Measured under 4× CPU throttle (low-end proxy) over a realistic newsletter fixture: 99.2% of frames within budget, detection p95 < 0.1 ms (pure arithmetic over pre-snapshotted geometry — no per-frame layout reads). Enforced by `packages/core/bench/dnd-perf.bench.ts`; see `packages/core/PERF-DND-FINDINGS.md`. Physical-hardware sign-off is ENV-49. |
| OD-4 | **Core bundle-size budget** (gzipped) | ✅ **RESOLVED 2026-06-22 → ~100 kB gzip** for `@enveloppe/core` (editor only; MJML renderer excluded, runs at export). Best-in-class lean, potato-PC-first. Enforced in CI via `measure.ts` (from OD-2). **This budget decides OD-1 (see below).** |
| OD-5 | Block → MJML mapping gaps | Per-block raw-table fallback authored in the renderer when MJML can't express a block. |
| OD-6 | **Canvas DnD engine** (Pragmatic vs custom) | ✅ **RESOLVED 2026-06-23 → custom pointer-event DnD for the canvas; Pragmatic dropped.** Pragmatic DnD binds drag listeners to the top-level host `document` and uses the native HTML5 drag API; the canvas lives in a same-origin **srcdoc iframe** (§6.4), so iframe-originated drags never reach Pragmatic and native-drag isn't reliably driveable cross-browser/touch in Playwright. The iframe protects the non-negotiable no-CSS-bleed guarantee (ENV-18) and gives clean iframe-local hit-testing (ENV-17), so the engine yields, not the architecture. Canvas dragging is implemented with pointer events (`pointerdown/move/up`) inside the iframe via the ENV-17 coordinate controller — controllable, `page.mouse`-testable, touch-capable. **Overrides "DnD = Pragmatic"** in §6.6 / `_conventions.md` for the canvas. Accessibility (keyboard reorder + ARIA, §6.6) is unchanged — always ours. |
| R-1 | contenteditable cross-browser divergence (Safari/iOS) | Headless engine (**Lexical**, per OD-1/OD-4); curated node set gives schema-like sanitization. **Elevated by the Lexical choice:** more manual wiring than Tiptap → budget heavier Safari/IME QA (ENV-32) to offset. |
| R-2 | iframe ↔ host coordinate translation across zoom/scroll | Single drag controller owns it; covered by Playwright interaction tests. |
| R-3 | OSS scope creep | This PRD's non-goals (§3) and v1 done-bar (§12) are the cutline. |
