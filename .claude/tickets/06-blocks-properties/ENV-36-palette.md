---
id: ENV-36
title: Block palette (categorized, drag source)
status: done
priority: P0
milestone: 6 — Blocks & properties
depends_on: [ENV-33, ENV-19]
blocks: [ENV-46]
package: core
prd: [§6.5]
estimate: M
---

# ENV-36 — Block palette (categorized, drag source)

## Context
The palette (§6.5) is the left-hand region where users pick blocks to add. It is
**data-driven from the registry** (ENV-33): every registered block contributes an
entry (icon, label, category), so custom blocks appear automatically. Critically, the
palette is the **drag SOURCE** for the Pragmatic DnD system (ENV-19) — dragging a
palette item onto the canvas creates a new block from its `palette.defaults`. Chrome,
so themed by `--eb-*`, Shadow DOM, no host-CSS bleed.

## Goal
A Lit component `<eb-palette>` lists registry blocks grouped by category with their
icons/labels, and registers each item as a Pragmatic-DnD draggable that, on drop,
inserts a new block (built from `palette.defaults`) into the doc.

## Prerequisites
- ENV-33 done (`blockRegistry.byCategory()`, `PaletteEntry` with `icon/label/category/
  defaults`).
- ENV-19 done (Pragmatic DnD integration: the `draggable()` registration + the
  drop-target/insertion machinery on the canvas that consumes a "new block" payload).
- ENV-14 shell (`part="palette"` mount + `--eb-*` theming).
- `config.enabledBlocks` (ENV-14) to optionally filter which entries show.

## Implementation notes
Create under `packages/core/src/palette/`:

1. **`palette.ts`** — `EbPalette extends LitElement` (`eb-palette`):
   ```ts
   @property({ attribute: false }) enabledBlocks?: string[]; // from config; undefined = all
   ```
   - Read `blockRegistry.byCategory()`; render a section per category with a header and
     a grid of palette items (`icon` + `label`). Filter by `enabledBlocks` when set.
   - Each item carries `data-block-type` for the drag payload.
2. **Drag source (Pragmatic DnD).** For each rendered item, register it with the
   ENV-19 `draggable()` API. The drag **payload** identifies the new block:
   ```ts
   getInitialData: () => ({ kind: "new-block", blockType: entry.type })
   ```
   - Use a **custom drag preview** styled to match (hand off to ENV-22 if present;
     otherwise a simple themed ghost is fine here).
   - On drop, ENV-19/41's canvas drop-target reads `kind: "new-block"`, builds a node
     from `blockRegistry.get(blockType).palette.defaults` (assigning a fresh id via the
     doc-model factory), and inserts it at the indicated position via an ENV-06 op. If
     ENV-19 expects the source to construct the node, do that here using the factory;
     either way, document which side constructs and keep it single-owner.
3. **Keyboard parity (a11y).** Each palette item is focusable and has a keyboard
   "Add" affordance (Enter / a context action) that inserts the block at a sensible
   default location, feeding the same ARIA-live path as ENV-23/45. Drag is not the only
   way to add a block.
4. **Theming.** Items, headers, hover/focus states use `--eb-*` tokens (ENV-18);
   Shadow DOM; no host CSS. Icons are the `palette.icon` strings (emoji or inline SVG).
5. **Mount** into the shell's `part="palette"` slot; pass `enabledBlocks` from
   `config`. Live-update if the registry changes after init is out of scope (registry is
   populated at init) — render from a snapshot taken on connect.
6. **Budget** — Lit + small templates; reuse ENV-19's `draggable()`; no new runtime dep.

## Acceptance criteria
- [ ] `<eb-palette>` lists every registered block grouped by `category`, showing
      `icon` + `label` from each `PaletteEntry`.
- [ ] `config.enabledBlocks` filters which entries appear; undefined shows all built-ins.
- [ ] Each item is a Pragmatic-DnD drag source carrying a `{ kind: "new-block",
      blockType }` payload; dropping on the canvas inserts a new block built from
      `palette.defaults` (fresh id, valid via `validateDoc`) via an ENV-06 op.
- [ ] Each item is keyboard-operable to add a block (not drag-only), feeding ARIA-live.
- [ ] Themed entirely via `--eb-*`; no host CSS bleed (Shadow DOM).
- [ ] Unit tests cover registry→grouped-rendering and the enabledBlocks filter; a
      Playwright test drags a palette item to the canvas and asserts a new block appears
      (chromium + webkit).

## Out of scope
- The DnD engine, drop-zone detection, insertion indicators (ENV-19/41) — palette is
  only the source.
- Custom drag preview polish (ENV-22, if separate).
- Properties editing of the dropped block (ENV-35).

## Verification
```bash
cd packages/core
bun test
bun run build
bun run lint
bun run e2e  # chromium + webkit: drag "Text" from palette to canvas → block created
```

## Definition of done
See `_conventions.md`. Registry-driven palette acts as DnD source + keyboard add;
themed by `--eb-*`; size gate green; status → `review`.
