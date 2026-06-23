---
id: ENV-30
title: Lexical ↔ doc-model RichTextJSON round-trip
status: ready
priority: P0
milestone: 5 — Inline rich text
depends_on: [ENV-27, ENV-09]
blocks: []
package: core
prd: [§6.1]
estimate: M
---

# ENV-30 — Lexical ↔ doc-model RichTextJSON round-trip

## Context
The doc model is the single source of truth and stores text as **portable
`RichTextJSON`** (ENV-05's `rich-text.ts`) so it never depends on Lexical (§6.1).
The live Lexical editor (ENV-27) has its own internal editor state; this ticket
builds the **lossless** bridge both ways — seed Lexical from `RichTextJSON`, and on
blur serialize the editor state back into `RichTextJSON` and commit it into the
doc via ENV-06 `setRichText`. If this round-trip drops a mark or a link, edits
silently corrupt content, so losslessness for the v1 mark set is the hard bar.

## Goal
`RichTextJSON → Lexical state → RichTextJSON` is lossless for the v1 content set
(paragraphs, bold/italic/underline, headings, lists, links), and on TextBlock blur
the content is committed back into the doc via ENV-06 `setRichText`.

## Prerequisites
- ENV-27 done (`mountLexical`, `LexicalMount.toJSON()`, `{ discrete: true }` seed).
- ENV-28 (the `onCommit(nodeId, json)` blur hook to call into).
- ENV-09 done (serialize/deserialize — the doc round-trips losslessly to JSON; this
  ticket guarantees the *text* part of that is lossless through the editor too).
- ENV-06 `setRichText(doc, textBlockId, RichTextJSON)` → `{ doc, patch, inverse }`.
- ENV-05 `RichTextJSON` (paragraphs → runs with `marks` + `link`; plus heading /
  list block kinds — extend the portable shape if ENV-05 didn't include them, in
  coordination with that schema, keeping it engine-independent).

## Implementation notes
Create under `packages/core/src/richtext/`:

1. **`serialize.ts`** — the two pure converters, the single source of mapping
   truth (ENV-27's seed + `toJSON` should call into these rather than duplicating):
   ```ts
   // doc → editor: run inside editor.update(fn, { discrete: true })
   export function $applyRichTextJSON(json: RichTextJSON): void; // builds nodes into $getRoot()
   // editor → doc: run inside editor.getEditorState().read(...)
   export function $readRichTextJSON(): RichTextJSON;
   ```
   - **Paragraph/heading:** map `ParagraphNode`↔`{ type: "paragraph" }` and
     `HeadingNode(tag)`↔`{ type: "heading", level }`.
   - **Runs/marks:** `TextNode` formats ↔ `marks: ("bold"|"italic"|"underline")[]`
     via `hasFormat`/`toggleFormat` (the spike pattern).
   - **Link:** a `LinkNode` wrapping text ↔ run(s) carrying `link: href`. On read,
     flatten the link's text children into runs with `link` set; on apply, group
     adjacent runs sharing a `link` under a `$createLinkNode(href)`.
   - **Lists:** `ListNode`/`ListItemNode` ↔ a list block shape
     (`{ type: "list", ordered, items: paragraph[] }` or the shape ENV-05 defines).
   - Be deterministic: stable run ordering, no empty runs, collapse adjacent runs
     with identical marks+link (so the round-trip is canonical, not just equal).
2. **Blur commit** — implement the `onCommit(nodeId, json)` that ENV-28 calls on
   blur:
   ```ts
   const op = setRichText(getDoc(), nodeId, json);
   dispatch(op); // editor merges patch into doc + undo history (ENV-06/12)
   ```
   Only commit if the content actually changed (compare to the current
   `TextBlock.content`) to avoid empty undo entries.
3. **Canonicalization for "lossless"** — define losslessness as: `read(apply(json))`
   deep-equals `canonicalize(json)` (input is first canonicalized so an
   already-canonical doc round-trips identically). Provide `canonicalize(json)`
   used by both the test and the renderer's static path if helpful.
4. **Reuse in ENV-27** — refactor ENV-27's seed + `toJSON` to call
   `$applyRichTextJSON` / `$readRichTextJSON` so there is exactly one mapping.

## Acceptance criteria
- [ ] `$applyRichTextJSON` + `$readRichTextJSON` cover paragraph, heading,
      bold/italic/underline, links, and lists.
- [ ] **Lossless law:** for a corpus of `RichTextJSON` docs,
      `$readRichTextJSON($applyRichTextJSON(json))` deep-equals
      `canonicalize(json)` (run via discrete update + state read).
- [ ] Adjacent runs with identical marks/link are collapsed; no empty runs;
      stable ordering (canonical output).
- [ ] On TextBlock blur, content is committed into the doc via `setRichText`
      (ENV-06), producing a patch + undo entry, only when changed.
- [ ] ENV-27's seed + `toJSON` are refactored to use these converters (one mapping).
- [ ] Works in Chromium + WebKit (the discrete-update read path is engine-correct
      in both, per the spike).

## Out of scope
- The lifecycle/focus-blur eventing (ENV-28) — this ticket implements the
  `onCommit` body it calls.
- Paste sanitization (ENV-31). Merge tags (ENV-39).
- Doc-level JSON file serialize (ENV-09) — this is only the text-content bridge.

## Verification
```bash
cd packages/core
bun test     # lossless law over a corpus (marks/link/list/heading); canonicalization; setRichText called on change only
bun run build
bun run lint
bun run e2e  # chromium + webkit: edit text + add bold/link/list → blur → reload doc shows the same content
```

## Definition of done
See `_conventions.md`. Lossless Lexical↔RichTextJSON bridge + blur commit via
ENV-06, cross-browser; status → `review`.
