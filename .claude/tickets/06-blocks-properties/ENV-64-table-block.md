---
id: ENV-64
title: Table block (data table via raw-table export)
status: done
priority: P2
milestone: 6 — Blocks & properties
depends_on: [ENV-34, ENV-33]
blocks: []
package: core
prd: [§12]
estimate: M
---

# ENV-64 — Table block (data table)

## Context
A simple data table — rows × columns of text cells, with an optional header row — is a
recurring need (pricing, specs, schedules). It ships through the **same** `registerBlock`
path as the core blocks (ENV-34) — no special-case path. MJML has no generic table
component, so export goes through the raw-table fallback (`<mj-raw>` wrapping real
table HTML). This is also the one block where a `<table>` legitimately appears on the
canvas, since the table IS the content (the canvas otherwise avoids tables, §6.2).

## Goal
A registered `table` block that edits a rows × cols grid of text cells (optional header
row) on the canvas and exports an email-safe `<table>` via `<mj-raw>`.

## Prerequisites
- ENV-34 done (the core-block patterns: `BlockDefinition` shape, `applyStyle`, the MJML
  mapping conventions, schema/palette conventions, factory-aligned defaults).
- ENV-33 done (`registerBlock`, `BlockDefinition`, `BlockSchema`/`FieldDef`, the `{ raw }`
  export-output path).
- ENV-05 node types — if the doc model needs a `table` node type carrying the cell grid,
  add it minimally and update `validateDoc`.

## Implementation notes
Create `packages/rime-core/src/blocks/core/table.ts`, exporting a `BlockDefinition`, and
register it from `registerCoreBlocks()` (ENV-34).

1. **Schema gap (shared work — first step).** The schema DSL (`FieldDef` in `schema.ts`)
   has no array/repeater/list `FieldType`, but a table is a 2-D structure of cells (rows
   of cells). Extend `schema.ts` with the array/repeater (`list`) `FieldType` — the same
   one ENV-59 (menu) and ENV-63 needs — supporting add/remove/reorder of rows (and
   columns). This is **shared work**: land it once across ENV-59/ENV-63/ENV-64, don't
   duplicate. If a 2-D grid is awkward for the generic `list` field, edit the grid via a
   dedicated custom control and document the dependency.
2. **Node type** `"table"`.
3. **Node shape / props.**
   ```ts
   // block props: {
   //   rows: string[][];        // rows of cell text (rows.length × cols)
   //   header: boolean;         // first row is a <th> header row
   //   border: "none" | "thin" | "thick"; // or a {width,color,style} struct
   //   style: BlockStyle;       // spacing
   // }
   ```
4. **`schema`.** The `list`-driven rows/cols editor, a `header` `boolean` toggle, a
   `border` `select` (border style), and `style.paddingTop`(+R/B/L) spacing.
5. **`renderCanvas`.** A real `<table>` in the PREVIEW — **this is the one block where a
   `<table>` is allowed on canvas** because the table is the content; note this explicitly
   (the canvas normally avoids tables per §6.2). Render `<thead>`/`<th>` when `header`,
   else `<tbody>`/`<td>`; apply the border style; stamp `data-node-id`; reuse `applyStyle`.
6. **`renderExport`.** Raw-table fallback path (MJML has no generic table):
   `{ raw: "<mj-raw><table …><tr><td>…</td>…</tr>…</table></mj-raw>" }`. Emit email-safe
   table HTML (inline styles, `cellpadding`/`cellspacing`/`border` attrs as needed),
   header row as `<th>` when toggled, the chosen border style inlined. **Escape every
   cell value.** Use `{ raw }` so the renderer routes it through the passthrough path.
7. **`palette`.** `{ label: "Table", icon: "⊞", category: "Content",
   defaults: { rows: [["", ""], ["", ""]], header: false, border: "thin", style: {} } }`.
8. **Budget** — pure DOM/string building, no new runtime dep.

## Acceptance criteria
- [ ] `schema.ts` gains the array/repeater (`list`) `FieldType` (shared with
      ENV-59/ENV-63) — or a documented custom grid control — enabling add/remove/reorder
      of rows/cols.
- [ ] A `table` block is registered via `registerBlock` (same path as core blocks).
- [ ] `renderCanvas` paints a real `<table>` (the single sanctioned canvas table, noted as
      the §6.2 exception), with a `<th>` header row when `header` is on; `data-node-id`
      present.
- [ ] `renderExport` returns `{ raw }` wrapping email-safe `<table>` HTML in `<mj-raw>`,
      header row + border style applied, **every cell escaped**; output compiles via the
      MJML renderer.
- [ ] Dropped-block defaults round-trip through `validateDoc` as valid.
- [ ] Unit tests cover schema (grid editing), canvas DOM (header toggle), and raw-table
      export with escaping (`bun test`).

## Out of scope
- Cell merging (colspan/rowspan), per-cell styling, and rich text inside cells (plain
  text cells for v1).
- Sorting / responsive collapse / sticky headers.
- CSV import.

## Verification
```bash
cd packages/rime-core
bun test
bun run build
bun run lint
```

## Definition of done
See `_conventions.md`. Table block ships via the public block path; raw-table `<mj-raw>`
export with escaped cells; size gate green; status → `review`.
