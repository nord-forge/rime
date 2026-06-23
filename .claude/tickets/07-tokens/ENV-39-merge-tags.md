---
id: ENV-39
title: "{{variable}} merge tags in rich text"
status: ready
priority: P1
milestone: 7 — Personalization tokens
depends_on: [ENV-27]
blocks: [ENV-40, ENV-41]
package: core
prd: [§6.9]
estimate: M
---

# ENV-39 — `{{variable}}` merge tags in rich text

## Context
Personalization v1 (§6.9) is basic `{{variable}}` merge tags inserted inline in text —
no conditionals/loops. A token is a **first-class inline node** in the rich-text
editor (not raw typed text), so it renders as an atomic, styled chip in the editor,
survives the portable `RichTextJSON` round-trip (ENV-30), and exports to literal
`{{var}}` in the email HTML. This is the data + render foundation; the picker UI
(ENV-40) and `registerToken` config (ENV-41) build on it.

## Goal
A token node type exists in the Lexical editor and in `RichTextJSON`, round-trips
losslessly through the doc model, and exports to `{{var}}` text via the MJML renderer.

## Prerequisites
- ENV-27 done (headless Lexical mounted in the canvas; `.claude/spikes/od1-richtext/src/
  lexical-adapter.ts` curated-node pattern — add the token node to that curated set).
- ENV-30/ENV-05 (`RichTextJSON`: paragraphs → runs with `marks`/`link`) — the portable
  shape this extends.
- ENV-11 (`richTextToInlineHtml` — must learn to emit token output).

## Implementation notes
1. **Portable shape (`@enveloppe/doc-model` `rich-text.ts`).** Extend the run/inline
   union with a token inline:
   ```ts
   export interface TokenInline {
     kind: "token";
     token: string;        // the variable key, e.g. "first_name" (NO braces stored)
     label?: string;       // optional display label for the editor chip
   }
   // a paragraph's children become (TextRun | TokenInline)[]
   ```
   Storing the bare key (not `{{first_name}}`) keeps the data clean; braces are a render
   concern. Update `validateDoc` to accept token inlines (non-empty `token` string).
2. **Lexical token node (`packages/core/src/richtext/token-node.ts`).** A custom
   `DecoratorNode`/`TextNode` subclass registered in the curated node set
   (lexical-adapter). It is **atomic** (not editable char-by-char; selectable/deletable
   as a unit), renders a themed chip (`--eb-*`) showing `label ?? token`, and serializes
   to/from the `TokenInline` shape via the adapter's `to/fromRichTextJSON`.
3. **Editor ↔ RichTextJSON round-trip.** Extend the ENV-30 adapter so:
   - Lexical token node → `TokenInline` on serialize,
   - `TokenInline` → Lexical token node on load.
   Assert a doc with mixed text + tokens round-trips byte-equivalent (ENV-09 law).
4. **Insertion API.** Export `insertToken(token: string, label?: string)` that inserts a
   token node at the current selection in the live editor (the picker UI in ENV-40
   calls this). One live editor instance only (ENV-28) — operate on the active one.
5. **Export (`@enveloppe/renderer-mjml`).** Teach `richTextToInlineHtml` to emit a token
   inline as the literal string `{{` + escapedKey + `}}` (so ESPs do the substitution).
   The key is escaped for HTML safety but braces are literal. Token chips therefore
   become real merge tags in the sent email.
6. **Canvas preview (ENV-16 static paint).** The read-only canvas paint of a text block
   shows tokens as chips too (visual parity with the editor), not raw braces.
7. **Budget** — one small Lexical node + chip styling; no new runtime dep.

## Acceptance criteria
- [ ] `TokenInline` is part of `RichTextJSON`; `validateDoc` accepts it (rejects empty
      `token`).
- [ ] A Lexical token node renders an atomic, themed chip and serializes to/from
      `TokenInline` via the ENV-30 adapter.
- [ ] A text block mixing text + tokens round-trips losslessly
      (`deserialize(serialize(doc))` deep-equals) — tokens survive.
- [ ] `insertToken("first_name")` inserts a token at the caret in the live editor.
- [ ] MJML export renders a token as literal `{{first_name}}` (key escaped, braces
      literal) in the output HTML.
- [ ] Canvas preview shows tokens as chips, not raw braces.
- [ ] Unit tests cover the shape, round-trip, and export; a Playwright test inserts a
      token and asserts a chip appears (chromium + webkit).

## Out of scope
- The token picker UI (ENV-40) — this provides `insertToken`, not the menu.
- `registerToken` / token-source config (ENV-41) — token *sets* come from there.
- Conditionals/loops/repeaters (explicitly excluded from v1).

## Verification
```bash
cd packages/core
bun test
bun run build
bun run lint
bun run e2e  # chromium + webkit: insertToken → chip rendered; export shows {{var}}
# round-trip law also asserted in packages/doc-model
```

## Definition of done
See `_conventions.md`. Token node round-trips and exports to `{{var}}`; size gate
green; status → `review`.
