---
id: ENV-58
title: Quote (pull-quote) block
status: ready
priority: P1
milestone: 6 — Blocks & properties
depends_on: [ENV-34, ENV-33]
blocks: []
package: core
prd: [§12]
estimate: S
---

# ENV-58 — Quote (pull-quote) block

## Context
A pull-quote is a common editorial element: a blockquote set off with its own left
border, padding, and an optional citation line. It ships through the **same**
`registerBlock` path as the core blocks (ENV-34) — no special-case path — and exports
cleanly to a styled blockquote inside a native `<mj-text>`.

## Goal
A registered `quote` block that paints a styled `<blockquote>` (with optional citation)
on the canvas and exports a native `<mj-text>` containing that blockquote.

## Prerequisites
- ENV-34 done (the core-block patterns: `BlockDefinition` shape, `applyStyle`, the MJML
  mapping conventions, schema/palette conventions, factory-aligned defaults).
- ENV-33 done (`registerBlock`, `BlockDefinition`, `BlockSchema`/`FieldDef`, render
  contexts).
- ENV-05 node types — this block carries plain props; if the doc model needs a `quote`
  node type, add it minimally and update `validateDoc`.

## Implementation notes
Create `packages/rime-core/src/blocks/core/quote.ts`, exporting a `BlockDefinition`, and
register it from `registerCoreBlocks()` (ENV-34).

1. **Node type** `"quote"`.
2. **Node shape / props.**
   ```ts
   // block props: { text: string; citation?: string; accentColor?: string; style: BlockStyle }
   ```
3. **`schema`.** Fields:
   | key | type | group |
   |-----|------|-------|
   | `text` | `text` | Content |
   | `citation` | `text` (optional) | Content |
   | `accentColor` | `color` (the left border) | Colors |
   | `style.align` | `align` | Layout |
   | `style.paddingTop` (+ R/B/L) | `spacing` | Spacing |
4. **`renderCanvas`.** A `<blockquote>` with a left border (`border-left` using
   `accentColor`), inner padding, `text` as content, and — when `citation` is set — a
   `<cite>`/footer line beneath it. Stamp `data-node-id`; reuse `applyStyle`. No table.
5. **`renderExport`.** Native MJML, cheap — `<mj-text>` wrapping a styled blockquote:
   `{ mjml: "<mj-text ...><blockquote style=\"border-left:4px solid …;padding-left:…\">${escape(text)}<cite>…</cite></blockquote></mj-text>" }`.
   Inline the accent border + padding into the blockquote's `style` (email-safe inline
   CSS); map block spacing/align to `<mj-text>` attrs via `styleToMjmlAttrs`. Escape
   `text` and `citation`; omit the `<cite>` when citation is empty.
6. **`palette`.** `{ label: "Quote", icon: "❝", category: "Content",
   defaults: { text: "A memorable quote.", accentColor: "#cccccc", style: {} } }`.
7. **Budget** — pure DOM/string building, no new runtime dep.

## Acceptance criteria
- [ ] A `quote` block is registered via `registerBlock` (same path as core blocks).
- [ ] `renderCanvas` paints a `<blockquote>` with the accent left border + padding and a
      citation line only when `citation` is set; `data-node-id` present; no `<table>`.
- [ ] `renderExport` emits `<mj-text>` wrapping a styled blockquote with inline accent
      border; text/citation escaped; citation omitted when empty; output compiles via the
      MJML renderer.
- [ ] Dropped-block defaults round-trip through `validateDoc` as valid.
- [ ] Unit tests cover schema, canvas DOM (with/without citation), and export (`bun test`).

## Out of scope
- Rich inline formatting inside the quote text (links/bold mid-quote) — use a Text block.
- Avatar/portrait imagery alongside the citation.

## Verification
```bash
cd packages/rime-core
bun test
bun run build
bun run lint
```

## Definition of done
See `_conventions.md`. Quote block ships via the public block path; native MJML export;
size gate green; status → `review`.
