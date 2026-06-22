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
- Built on **Pragmatic drag-and-drop** (`@atlaskit/pragmatic-drag-and-drop`): framework-agnostic (no React dep — fits Lit), tiny, purpose-built for **nested drop zones** (sections → columns → blocks) and large/virtualized lists, with first-class touch and a custom drag-preview API.
- **Accessibility is owned by Enveloppe regardless of engine:** a parallel keyboard-reordering path (select block → move up/down/into via keyboard or a "move to" menu) and **ARIA live-region announcements** ("Moved Button to Column 2, position 1 of 3"). Screen-reader/keyboard users cannot drag; this parallel input model is mandatory, not optional.
- Drop-zone **detection logic** is the stated do-or-die: it must be performant (throttled / `requestAnimationFrame`-disciplined hit-testing) and consistent across browsers and hardware tiers.

### 6.7 Rich-text editing (inline)
- A **headless, framework-agnostic** rich-text engine mounted on a plain DOM node inside the iframe canvas.
- **Lifecycle for memory:** exactly **one editor instance alive at a time** — created when a text block is focused, destroyed on blur — regardless of how many text blocks the email contains.
- Engine candidates (both framework-agnostic, MIT, headless UI):
  - **Tiptap / ProseMirror** — most mature; **strict schema** auto-sanitizes pasted content (Word/Outlook garbage) into the doc model; strongest cross-browser/IME/Safari track record; matches the original "Tiptap feel" inspiration.
  - **Lexical** (Meta) — perf-first, smaller bundle, gentler API; younger, less battle-tested for IME/Safari.
  - **Slate is rejected** — its rendering layer requires React.
- **DECIDED (OD-1, 2026-06-22): Tiptap / ProseMirror.** The spike (`spikes/od1-richtext/FINDINGS.md`) measured both engines inside a real Lit + iframe canvas across Chromium + WebKit. Result: both are genuinely framework-agnostic (no React/Vue dep). Lexical wins on bundle (~42 kB gzip wired vs Tiptap's +118.6 kB with StarterKit). A follow-up proved Lexical's paste sanitization reaches **full parity** with Tiptap once wired with `registerRichText` + a curated node set (so it's a wiring gap, not a capability gap). Tiptap is chosen on **ergonomics / default-correctness**: paste sanitization, synchronous `getJSON()`, undo, and commands all work out of the box, whereas Lexical needs explicit wiring (manual clipboard handlers, `{discrete:true}` updates, node curation) — each a place to get cross-browser/IME behaviour subtly wrong, which is the project's top risk. **Bundle gap is structural (ENV-56):** curating Tiptap extensions does *not* close the gap — minimal Tiptap is already ~108 kB gzip (the ProseMirror floor), and the realistic v1 set (with link/lists/headings) is ~128 kB, *larger* than StarterKit. Lexical wired is ~43 kB — a permanent ~3× / ~85 kB gap. **Therefore OD-4 (core bundle budget) now gates the engine choice (ENV-57):** keep Tiptap only if the budget affords ~128 kB of rich text; otherwise switch to Lexical (paste parity proven in the spike, ~3× lighter). Decide OD-4 before writing engine code (ENV-50).
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
| Rich text | headless **Tiptap/ProseMirror or Lexical** (spike-decided; Tiptap default), custom UI |
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
- **Bundle size budget** — core package within an agreed gzipped budget (set during the toolchain spike); tracked in CI.

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
| OD-1 | **Rich-text engine** (Tiptap vs Lexical) | ✅ **RESOLVED 2026-06-22 → Tiptap/ProseMirror.** See `spikes/od1-richtext/FINDINGS.md`. Decided on paste-sanitization + JSON round-trip strength despite larger bundle. |
| OD-2 | **Build toolchain** (rolldown-vite + Lit + CSS) stability | ✅ **RESOLVED 2026-06-22 → rolldown-vite.** Spike (`spikes/od2-toolchain/FINDINGS.md`) proved it builds AND runs a Lit + `css\`\`` + CSS-vars + iframe component, identical to stock Vite, passing browser smoke in Chromium + WebKit. oxlint/oxfmt confirmed Lit-safe. Stock Vite kept as drop-in fallback. Size gate (`measure.ts`) prototyped for OD-4. |
| OD-3 | Exact **drop-detection latency budget** (ms) | Set during the DnD-perf ticket on the reference machine. |
| OD-4 | **Core bundle-size budget** (gzipped) | **Promoted to blocking (ENV-57):** now gates the OD-1 engine choice. Rich text alone is ~128 kB (Tiptap) vs ~43 kB (Lexical) — a structural ~3× gap (ENV-56). Set the budget before engine code; if lean, OD-1 flips to Lexical. Enforced in CI. |
| OD-5 | Block → MJML mapping gaps | Per-block raw-table fallback authored in the renderer when MJML can't express a block. |
| R-1 | contenteditable cross-browser divergence (Safari/iOS) | Headless engine with strict schema (Tiptap) preferred; heavy Safari QA budget. |
| R-2 | iframe ↔ host coordinate translation across zoom/scroll | Single drag controller owns it; covered by Playwright interaction tests. |
| R-3 | OSS scope creep | This PRD's non-goals (§3) and v1 done-bar (§12) are the cutline. |
