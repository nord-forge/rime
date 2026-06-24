---
id: ENV-61
title: Column layout presets (2-col, 3-col, sidebar, image+text)
status: ready
priority: P1
milestone: 6 — Blocks & properties
depends_on: [ENV-34, ENV-33]
blocks: []
package: core
prd: [§12]
estimate: M
---

# ENV-61 — Column layout presets

## Context
Designers rarely build multi-column layouts column-by-column; they reach for a ready-made
structure. These presets are palette entries that, when dropped, insert a complete
`Section` + `Column` subtree (with the right `widthPercent` split) rather than a single
leaf block: 2-column, 3-column, sidebar (1/3 + 2/3), and image+text. They build on the
**same** registration surface as the core blocks (ENV-34) — the Section/Column nodes and
their export are already handled there — so this ticket is purely about the palette
producing a subtree.

## Goal
Palette entries for 2-column, 3-column, sidebar (1/3 + 2/3), and image+text layouts, each
dropping a valid `Section` with the correctly-sized `Column` children.

## Prerequisites
- ENV-34 done — Section/Column `BlockDefinition`s (canvas + `<mj-section>`/`<mj-column>`
  export) and their factory helpers (`createSection()`, `createColumn()`) already exist;
  these presets only assemble them.
- ENV-33 done (`registerBlock`, `PaletteEntry`, the registry).
- ENV-05 invariant that columns in a section sum to 100% `widthPercent`.

## Implementation notes
Create `packages/rime-core/src/blocks/core/column-presets.ts`, and wire its entries in
`registerCoreBlocks()` (ENV-34). These are **not leaf blocks** — they have no own node
type; they produce a subtree of existing Section/Column nodes.

1. **Design decision — subtree-producing palette entries (call this out).** A normal
   `PaletteEntry.defaults` yields a single leaf node's props. A preset must yield a
   `Section` node **with `Column` children**. Pick and document one of:
   - extend `PaletteEntry` so an entry may carry a `createSubtree()` that returns a node
     subtree (a `Section` with `Column` children) instead of (or alongside) `defaults`;
     OR
   - a separate `registerLayout(...)` / preset registry that the palette (ENV-36) reads
     in addition to `blockRegistry`.
   Whichever is chosen, it must integrate with the existing palette + drop flow without a
   privileged path, and the produced subtree must validate.
2. **The four presets** (each a Section with evenly/explicitly split columns):
   | preset | columns (`widthPercent`) | seed children |
   |--------|--------------------------|----------------|
   | 2-column | 50 / 50 | empty columns |
   | 3-column | 33 / 34 / 33 (sum 100) | empty columns |
   | sidebar | 33 / 67 | empty columns |
   | image+text | 50 / 50 | left column seeded with an `image` block, right with a `text` block |
3. **Build subtrees via the ENV-05 factories** (`createSection`, `createColumn`, and for
   image+text the `image`/`text` factories) so every produced node is valid and gets
   fresh ids on drop. Columns must sum to 100% (ENV-05 invariant).
4. **Palette metadata.** Each preset gets its own `label`/`icon`/`category: "Layout"`
   (e.g. "2 columns", "Sidebar", "Image + text") with a distinguishing icon.
5. **Export** is free — once dropped, the subtree is plain Section/Column (+ image/text)
   nodes already handled by ENV-34/ENV-11. No new `renderExport` here.
6. **Budget** — pure node construction, no new runtime dep.

## Acceptance criteria
- [ ] The palette/registry supports preset entries that, on drop, insert a `Section` +
      `Column` **subtree** (not a single leaf) — design documented, no privileged path.
- [ ] Four presets exist: 2-column (50/50), 3-column (33/34/33), sidebar (33/67), and
      image+text (50/50 seeded with an image + a text block).
- [ ] Each preset's produced subtree validates via `validateDoc`, with columns summing to
      100% and fresh ids on every drop.
- [ ] Dropped presets export through the existing Section/Column (+ image/text) handlers
      — no new export code, output compiles via the MJML renderer.
- [ ] Presets appear in the palette under "Layout" with distinct labels/icons.
- [ ] Unit tests cover each preset's produced subtree (column count + widths sum to 100,
      seeded children, `validateDoc` passes) (`bun test`).

## Out of scope
- Arbitrary N-column or custom-ratio builders (these are fixed presets).
- Responsive/stacking behaviour config — inherited from Section/Column defaults.
- Nested sections inside a preset.

## Verification
```bash
cd packages/rime-core
bun test
bun run build
bun run lint
```

## Definition of done
See `_conventions.md`. Presets drop valid Section/Column subtrees via the palette;
export reuses ENV-34/ENV-11; size gate green; status → `review`.
