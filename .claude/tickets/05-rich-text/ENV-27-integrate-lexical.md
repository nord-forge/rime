---
id: ENV-27
title: Integrate Lexical headless in the canvas
status: done
priority: P0
milestone: 5 — Inline rich text
depends_on: [ENV-16]
blocks: [ENV-28, ENV-29, ENV-30, ENV-31, ENV-32]
package: core
prd: [§6.7]
estimate: L
---

# ENV-27 — Integrate Lexical headless in the canvas

## Context
Inline rich text is edited by **Lexical, headless** — chosen by OD-1 because the
~100 kB core budget (OD-4) is exceeded by Tiptap's rich text alone
(~128 kB gzip), while wired Lexical is ~43 kB (see `.claude/spikes/od1-richtext/FINDINGS.md`
+ `ENV-56-FINDINGS.md`). The engine mounts on the **focused TextBlock's element
inside the iframe canvas** and is used headless (no Lexical UI — that is ENV-29).
The working, sanitization-correct integration already exists in
`.claude/spikes/od1-richtext/src/lexical-adapter.ts` (read it first) — this ticket
**ports** that adapter into `@nord-forge/rime-core` and re-confirms the budget against
real measured core weight. Spikes are throwaway; copy the approach, do not import
from `.claude/spikes/`.

## Goal
`@nord-forge/rime-core` mounts a single headless Lexical editor onto a focused
TextBlock node inside the iframe, seeded from the doc's `RichTextJSON`, with
bold/italic/underline working — and the measured `@nord-forge/rime-core` gzip is
recorded against the ~100 kB budget.

## Prerequisites
- ENV-16 done (`CanvasRenderer` paints TextBlocks into the iframe; each carries
  `data-node-id`; the static `RichTextJSON` rendering exists — the live editor
  replaces it on focus).
- OD-4 done (OD-4 budget = ~100 kB gzip; CI `measure.ts` exists). Reference its
  decision: Lexical was chosen *because* of this budget.
- Read `.claude/spikes/od1-richtext/src/lexical-adapter.ts` and `src/adapter.ts`
  (`RichTextJSON` shape, `EngineAdapter` contract).
- Runtime deps to add: `lexical`, `@lexical/rich-text`, `@lexical/utils`,
  `@lexical/clipboard`, `@lexical/html` — **note combined gzip cost in the PR**.

## Implementation notes
Create under `packages/core/src/richtext/`:

1. **`lexical-editor.ts`** — port the spike adapter to the production
   `RichTextJSON` from `@nord-forge/rime-model` (ENV-05's `rich-text.ts`, which adds
   `link?: string` to runs). Keep the spike's proven moves:
   - `createEditor({ namespace: "rime", nodes: [HeadingNode, QuoteNode], onError })`
     — **curated node set is the sanitization boundary** (the rationale ENV-31
     hardens). `ParagraphNode`/`TextNode` are built-in; add nodes only as ENV-29
     features require (e.g. list nodes).
   - `editor.setRootElement(blockEl)` — mount directly on the TextBlock's
     **existing** rendered element inside the iframe (set `contentEditable`,
     `role="textbox"` on it), so the editor edits the same node ENV-16 rendered.
   - `this.cleanup = mergeRegister(registerRichText(editor))` — installs the
     command handlers (incl. `PASTE_COMMAND` → `$insertDataTransferForRichText` →
     `$generateNodesFromDOM`) the paste pipeline (ENV-31) needs.
   - **Seed synchronously** with `editor.update(fn, { discrete: true })` — Lexical
     is deferred by default; the spike proved a naive read returns empty. Seed
     paragraphs → text runs → `node.toggleFormat(mark)` per mark; apply `link` as
     ENV-29/53 define (a run with `link` becomes a LinkNode when that lands).
   ```ts
   export interface LexicalMount {
     readonly editor: LexicalEditor;
     toJSON(): RichTextJSON;   // read editor state → portable shape (see ENV-30)
     destroy(): void;          // cleanup() + setRootElement(null); release refs
   }
   export function mountLexical(blockEl: HTMLElement, initial: RichTextJSON): LexicalMount;
   ```
2. **Mount inside the iframe** — the editor lives in the iframe document. Use the
   iframe's `document`/`window` for any DOM the adapter creates (clipboard,
   selection are iframe-local). Create the editor only when a TextBlock is focused
   — the one-instance lifecycle (create-on-focus / destroy-on-blur) is enforced in
   ENV-28; this ticket exposes `mountLexical`/`destroy` and a single focus entry
   point it will drive.
3. **`toJSON()`** — read editor state via `editor.getEditorState().read(...)`,
   walking root → paragraphs → `TextNode`s, mapping `hasFormat("bold"|"italic"|
   "underline")` to `marks` (and link → `link`), exactly like the spike's `toJSON`
   but typed against the production `RichTextJSON`. The lossless round-trip + blur
   write-back is ENV-30; here just expose the read.
4. **Budget hard-confirm (the OD-1/OD-4 gate)** — after integrating, run the core
   size measurement and record the real gzip:
   - If `@nord-forge/rime-core` (with Lexical wired) is **≤ ~100 kB gzip** → confirmed;
     note the number.
   - If it **exceeds ~100 kB**, note it loudly in the PR + a `RICHTEXT-BUDGET.md`.
     **Do NOT switch back to Tiptap** — Tiptap is heavier and only revives if the
     budget is *later raised* (per OD-4 / board). Instead flag for budget review.
5. **Export** the public mount API from `src/index.ts` as needed by ENV-28/52.
6. **No library UI** — do not import or render any Lexical-shipped toolbar/theme
   CSS. Visible UI is 100% custom (ENV-29).

## Acceptance criteria
- [ ] `mountLexical(blockEl, initial)` creates ONE headless Lexical editor on the
      focused TextBlock element inside the iframe, seeded from `RichTextJSON` via a
      `{ discrete: true }` update.
- [ ] `registerRichText` is wired (command/paste pipeline present); curated node
      set is `[HeadingNode, QuoteNode]` (+ built-in Paragraph/Text).
- [ ] Bold / italic / underline can be applied programmatically and reflect in
      `toJSON()` output.
- [ ] `toJSON()` returns the portable `RichTextJSON` (paragraphs → runs → marks).
- [ ] `destroy()` runs `cleanup()`, `setRootElement(null)`, and releases refs.
- [ ] No spike imports; no Lexical-shipped UI/CSS imported.
- [ ] **Measured `@nord-forge/rime-core` gzip is recorded** vs the ~100 kB budget;
      over-budget is flagged (not silently switched off Lexical).
- [ ] Works in Chromium + WebKit (mount + seed + format).

## Out of scope
- One-instance create/destroy lifecycle enforcement (ENV-28).
- Custom toolbar / bubble menu / link popover UI (ENV-29).
- Lossless doc round-trip + blur write-back (ENV-30).
- Paste sanitization hardening + tests (ENV-31). IME/Safari hardening (ENV-32).

## Verification
```bash
cd packages/core
bun test     # mount seeds from RichTextJSON; format → toJSON reflects marks; destroy cleans up
bun run build
bun run lint
bun run size   # MEASURE: record @nord-forge/rime-core gzip vs ~100 kB (OD-4 measure.ts)
bun run e2e    # chromium + webkit: focus a TextBlock → editor mounts in iframe, type + format works
```

## Definition of done
See `_conventions.md`. Headless Lexical mounted in-iframe per the spike approach,
budget measured + recorded; status → `review`.

## Outcome (OD-1/OD-4 budget hard-confirm)
With Lexical fully wired (`lexical`, `@lexical/rich-text`, `@lexical/utils`),
measured `@nord-forge/rime-core` = **50.58 kB gzip** (188.12 kB raw, 42.16 kB brotli) —
~51% of the ~100 kB budget. Confirms OD-1's engine choice: wired Lexical is far
under budget where Tiptap's rich text alone (~128 kB) would have blown it. The
mount API (`mountLexical` / `LexicalMount`) is exported from `src/index.ts` for
ENV-28's focus-driven lifecycle.
