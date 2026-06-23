---
id: ENV-54
title: Paste sanitization (Word/Outlook/Docs → schema-valid)
status: ready
priority: P1
milestone: 5 — Inline rich text
depends_on: [ENV-50]
blocks: []
package: core
prd: [§6.7]
estimate: M
---

# ENV-54 — Paste sanitization (Word/Outlook/Docs → schema-valid)

## Context
Users paste from Word, Outlook, and Google Docs, which carry `mso-*` styles,
`<font>` tags, deprecated attributes, and even `<script>` — none of which may
enter the doc model (§6.7). This is **de-risked**: the spike proved that Lexical's
`registerRichText` + a **curated node set** strips mso/font/script in both
Chromium and WebKit (see `.claude/spikes/od1-richtext/FINDINGS.md` §4/§4b and the wired
`.claude/spikes/od1-richtext/src/lexical-adapter.ts`). This ticket **ports** that proven
approach into `@enveloppe/core`, hardens it (explicit allow-list confirmation,
edge cases), and adds Playwright coverage so a regression can't silently let
garbage through.

## Goal
Pasting Word/Outlook/Docs HTML into a TextBlock yields only schema-valid content
(allowed marks/blocks; no `mso`, `<font>`, `<script>`, or unknown elements), with
Playwright proof in Chromium + WebKit.

## Prerequisites
- ENV-50 done (Lexical mounted with `registerRichText(editor)` + curated nodes
  `[HeadingNode, QuoteNode]` (+ Paragraph/Text), plus List/Link nodes from ENV-52
  if landed). The paste pipeline (`PASTE_COMMAND` →
  `$insertDataTransferForRichText` → `@lexical/html` `$generateNodesFromDOM`) is
  already wired by `registerRichText`.
- ENV-53's `$readRichTextJSON` to assert the *resulting doc content* is clean.

## Implementation notes
1. **The mechanism is already there — confirm + lock it** (per the spike):
   - `registerRichText(editor)` installs `PASTE_COMMAND`, routing pasted HTML
     through `$insertDataTransferForRichText` → `$generateNodesFromDOM`.
   - **Sanitization = the curated node set**: `$generateNodesFromDOM` keeps only
     DOM that a registered node's `importDOM()` claims; everything else
     (`mso-*`, `<font>`, `<script>`, `<o:p>`, unknown tags) is dropped. This is
     Lexical's analogue of ProseMirror's strict schema.
   - This ticket must NOT add a separate HTML sanitizer library (budget +
     redundant). The node set IS the boundary. If a feature needs a tag, add the
     node — don't widen with a generic passthrough.
2. **`packages/core/src/richtext/paste-fixtures.ts`** — capture representative
   dirty clipboard HTML strings as test fixtures (the kind real apps emit):
   - **Word/Outlook:** `<o:p>`, `mso-` styles, `<font face=...>`, `class="MsoNormal"`,
     conditional comments `<!--[if ...]>`.
   - **Google Docs:** `<b style="font-weight:normal">` wrappers, `id="docs-internal-..."`,
     inline `style` soup.
   - **Malicious:** `<script>`, `<img onerror=...>`, `javascript:` hrefs,
     `<iframe>` — must all be dropped/neutralized.
   Keep these as exported constants reused by unit + Playwright tests.
3. **Harden the edges** the spike didn't exhaustively cover:
   - **Links in paste:** an `<a href>` should survive as a link ONLY if `LinkNode`
     is registered (ENV-52); a `javascript:`/`data:` href must be stripped or the
     link dropped (validate href on import — reuse ENV-52's href normalizer).
   - **Bold/italic/underline** carried via `<b>/<strong>/<i>/<em>/<u>` or inline
     `font-weight`/`font-style` should map to the corresponding marks (verify
     `importDOM` of the registered nodes does this; if a common case is lost,
     handle it without opening the door to arbitrary styles).
   - **Plain-text fallback:** pasting `text/plain` only yields paragraphs of text,
     no formatting injection.
   - **Nested/garbage structure:** deeply nested mso tables collapse to plain
     paragraphs/text, never tables (the preview DOM has no `<table>`).
4. **`paste-sanitize.test.ts`** — for each fixture, programmatically dispatch a
   paste (construct a `DataTransfer`/`ClipboardEvent` with the dirty HTML, or call
   the editor's paste handler) into a mounted editor, then assert
   `$readRichTextJSON()` contains only allowed marks/blocks and NONE of:
   `mso`, `font`, `script`, `onerror`, `javascript:`, unknown tags.
5. **`packages/core/e2e/paste-sanitize.e2e.ts`** — real-browser proof in Chromium
   **and** WebKit: set the clipboard / dispatch a paste with a Word/Outlook fixture
   into a focused TextBlock, then read back the doc content and assert it is clean.
   WebKit clipboard handling diverges — this is exactly why the spike tested both;
   keep both in the matrix.

## Acceptance criteria
- [ ] Pasting each Word/Outlook/Docs fixture yields content with only allowed
      marks/blocks; `mso-*`, `<font>`, `MsoNormal`, `<o:p>`, conditional comments
      are gone.
- [ ] `<script>`, `onerror`, `javascript:`/`data:` hrefs, and `<iframe>` are
      dropped/neutralized — never reach the doc.
- [ ] `<b>/<i>/<u>` (and inline weight/style equivalents) map to the right marks;
      a safe `<a href>` survives as a link only when `LinkNode` is registered.
- [ ] Plain-text paste yields plain paragraphs (no formatting injection).
- [ ] Nested mso tables collapse to paragraphs/text — no `<table>` ever.
- [ ] No standalone HTML-sanitizer dependency added (the curated node set is the
      boundary); core still ≤ budget.
- [ ] Unit tests over all fixtures + Playwright paste tests pass in Chromium AND
      WebKit.

## Out of scope
- New rich-text features (ENV-52). Doc round-trip law (ENV-53).
- IME/mobile/Safari manual hardening (ENV-55).

## Verification
```bash
cd packages/core
bun test     # each dirty fixture → $readRichTextJSON has only allowed nodes; no mso/font/script/js-href
bun run build
bun run lint
bunx playwright install chromium webkit
bun run e2e -- paste-sanitize   # chromium + webkit: paste Word/Outlook HTML → doc content is clean
```

## Definition of done
See `_conventions.md`. Spike paste approach ported + hardened with cross-browser
Playwright coverage; status → `review`.
