---
id: ENV-59
title: Menu / Nav block (horizontal links)
status: ready
priority: P1
milestone: 6 — Blocks & properties
depends_on: [ENV-34, ENV-33]
blocks: []
package: core
prd: [§12]
estimate: M
---

# ENV-59 — Menu / Nav block (horizontal links)

## Context
A nav/menu block is a horizontal row of labelled links (label + href each) — the classic
email header navigation. It ships through the **same** `registerBlock` path as the core
blocks (ENV-34) — no special-case path. MJML has first-class `<mj-navbar>` /
`<mj-navbar-link>` elements, so export is native and cheap. The one wrinkle: the schema
DSL has no array field type yet, so the list of items needs a shared schema extension.

## Goal
A registered `menu` block listing configurable nav links (label + href), with a
schema-driven editor, a horizontal `<nav>` canvas preview, and `<mj-navbar>` export with
validated hrefs.

## Prerequisites
- ENV-34 done (the core-block patterns: `BlockDefinition` shape, `applyStyle`, the MJML
  mapping conventions, schema/palette conventions, factory-aligned defaults).
- ENV-33 done (`registerBlock`, `BlockDefinition`, `BlockSchema`/`FieldDef`, render
  contexts).
- The href normalizer used by the Button/Image blocks (rejects `javascript:` and similar
  unsafe schemes) — reuse it; do not re-implement.
- ENV-05 node types — if the doc model needs a `menu` node type with an `items` array,
  add it minimally and update `validateDoc`; else carry the array in the block's props
  and document it.

## Implementation notes
Create `packages/rime-core/src/blocks/core/menu.ts`, exporting a `BlockDefinition`, and
register it from `registerCoreBlocks()` (ENV-34).

1. **Schema gap (shared work — first step).** The schema DSL (`FieldDef` in
   `schema.ts`) currently lacks an array/repeater/list `FieldType`. This block needs to
   edit a list of `{ label, href }` rows. Extend `schema.ts` with a `"list"` (repeater)
   `FieldType` — `add` / `remove` / `reorder` rows, each row a small sub-schema of
   fields — OR store the items as a structured prop edited via a custom field control,
   and flag the dependency. This is **shared work**: ENV-59, ENV-63, and ENV-64 all need
   the array/repeater type. Coordinate so it lands once, not three times.
2. **Node type** `"menu"`.
3. **Node shape / props.**
   ```ts
   interface MenuItem { label: string; href: string; }
   // block props: { items: MenuItem[]; layout: "horizontal"; color?: string; style: BlockStyle }
   ```
4. **`schema`.** A `list` field for `items` (each row: `label` `text` + `href` `url`),
   plus `color`, `style.align`, `style.paddingTop`(+R/B/L) spacing. `layout` is
   `horizontal` for v1 (a `select` with one option, room to grow).
5. **`renderCanvas`.** A `<nav>` (flex row) of `<a>` per item honoring align + color;
   stamp `data-node-id`; reuse `applyStyle`. No table.
6. **`renderExport`.** Native MJML — `{ mjml: "<mj-navbar ...><mj-navbar-link href=...>${escape(label)}</mj-navbar-link>…</mj-navbar>" }`,
   one `<mj-navbar-link>` per item. **Normalize + validate every href** through the
   shared href normalizer; reject `javascript:` (drop the link or emit `#`). Escape
   labels and href attrs. Map color/align/spacing to navbar attrs.
7. **`palette`.** `{ label: "Menu", icon: "☰", category: "Content",
   defaults: { items: [{ label: "Home", href: "#" }, { label: "About", href: "#" }],
   layout: "horizontal", style: {} } }`.
8. **Budget** — pure DOM/string building, no new runtime dep.

## Acceptance criteria
- [ ] `schema.ts` gains an array/repeater (`list`) `FieldType` (or the documented custom
      control), enabling add/remove/reorder of `{ label, href }` rows; noted as shared
      with ENV-63/ENV-64.
- [ ] A `menu` block is registered via `registerBlock` (same path as core blocks).
- [ ] `renderCanvas` paints a horizontal `<nav>` of `<a>`s with `data-node-id`; no
      `<table>` on canvas.
- [ ] `renderExport` emits `<mj-navbar>` with one `<mj-navbar-link>` per item; labels and
      hrefs escaped; output compiles via the MJML renderer.
- [ ] hrefs are normalized/validated via the shared href normalizer; `javascript:` (and
      similar unsafe schemes) are rejected.
- [ ] Dropped-block defaults round-trip through `validateDoc` as valid.
- [ ] Unit tests cover schema (list editing), canvas DOM, `<mj-navbar>` export, and href
      rejection (`bun test`).

## Out of scope
- Vertical/stacked layouts and hamburger/responsive collapse behaviour.
- Dropdown / nested menus and per-link icons.

## Verification
```bash
cd packages/rime-core
bun test
bun run build
bun run lint
```

## Definition of done
See `_conventions.md`. Menu block ships via the public block path; native MJML export;
hrefs validated; size gate green; status → `review`.
