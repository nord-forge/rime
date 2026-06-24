---
id: ENV-57
title: Heading block (layout-level h1/h2/h3)
status: done
priority: P1
milestone: 6 — Blocks & properties
depends_on: [ENV-34, ENV-33]
blocks: []
package: core
prd: [§12]
estimate: S
---

# ENV-57 — Heading block (layout-level h1/h2/h3)

## Context
A standalone heading is a layout-level block whose entire content is one heading line
(h1/h2/h3) that can be styled and spaced on its own — distinct from a Text block, which
only produces inline headings inside flowing rich text. Email designers reach for a
dedicated heading block constantly (section titles, hero captions), so it earns a
first-class block rather than forcing a Text block. It ships through the **same**
`registerBlock` path as the core blocks (ENV-34) — no special-case path.

## Goal
A registered `heading` block that renders one configurable h1/h2/h3 line on the canvas
and exports a native `<mj-text>` wrapping the heading element.

## Prerequisites
- ENV-34 done (the core-block patterns: `BlockDefinition` shape, `applyStyle`, the MJML
  mapping conventions, schema/palette conventions, factory-aligned defaults).
- ENV-33 done (`registerBlock`, `BlockDefinition`, `BlockSchema`/`FieldDef`, render
  contexts).
- ENV-05 node types — this block carries plain props (`level`, `text`, `style`), no
  `RichTextJSON`; if the doc model needs a `heading` node type, add it minimally and
  update `validateDoc`.

## Implementation notes
Create `packages/rime-core/src/blocks/core/heading.ts`, exporting a `BlockDefinition`,
and register it from `registerCoreBlocks()` (ENV-34).

1. **Node type** `"heading"` — NOTE: this is deliberately distinct from the in-text
   heading node that lives inside a Text block's `RichTextJSON`. Here the whole block IS
   one heading line of plain text.
2. **Node shape / props.**
   ```ts
   // block props: { level: 1 | 2 | 3; text: string; color?: string; style: BlockStyle }
   ```
3. **`schema`.** Fields:
   | key | type | group |
   |-----|------|-------|
   | `level` | `select` (options 1/2/3) | Layout |
   | `text` | `text` | Content |
   | `color` | `color` | Colors |
   | `style.align` | `align` | Layout |
   | `style.paddingTop` (+ R/B/L) | `spacing` | Spacing |
4. **`renderCanvas`.** Create an `<h1>`/`<h2>`/`<h3>` per `level`, set `textContent` to
   `text`, stamp `data-node-id`, apply `color`/align/spacing via `applyStyle`. No table.
5. **`renderExport`.** Native MJML, cheap — `<mj-text>` wrapping the heading element:
   `{ mjml: "<mj-text ...><h${level} style=...>${escape(text)}</h${level}></mj-text>" }`.
   Map color/align/spacing to `<mj-text>` attrs via the shared `styleToMjmlAttrs`; inline
   the heading's own color into the `<h*>` style. Escape `text`.
6. **`palette`.** `{ label: "Heading", icon: "🅗", category: "Content",
   defaults: { level: 2, text: "Heading", style: {} } }`.
7. **Budget** — pure DOM/string building, no new runtime dep.

## Acceptance criteria
- [ ] A `heading` block is registered via `registerBlock` (same path as core blocks).
- [ ] `renderCanvas` paints an `<h1>`/`<h2>`/`<h3>` matching `level`, with `data-node-id`
      and applied color/align/spacing; no `<table>` on canvas.
- [ ] `renderExport` emits `<mj-text>` wrapping the correct `<h*>`, text escaped; output
      compiles via the MJML renderer.
- [ ] The `level` select switches the rendered tag in both canvas and export.
- [ ] Dropped-block defaults round-trip through `validateDoc` as valid.
- [ ] Unit tests cover schema, canvas DOM (tag per level), and `<mj-text>` export
      (`bun test`).

## Out of scope
- Rich inline formatting (bold/links/mixed runs inside the heading) — that is the Text
  block's job.
- Heading levels beyond h1–h3, and custom heading typography presets.

## Verification
```bash
cd packages/rime-core
bun test
bun run build
bun run lint
```

## Definition of done
See `_conventions.md`. Heading block ships via the public block path; native MJML export;
size gate green; status → `review`.
