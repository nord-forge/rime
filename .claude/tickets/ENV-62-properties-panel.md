---
id: ENV-62
title: Schema-driven properties panel
status: ready
priority: P0
milestone: 6 — Blocks & properties
depends_on: [ENV-60]
blocks: [ENV-92]
package: core
prd: [§6.5]
estimate: L
---

# ENV-62 — Schema-driven properties panel

## Context
The right-hand panel (§6.5) lets users tune the selected block's structure/style —
padding, colors, alignment, columns, etc. It is **schema-driven**: it reads the
selected block's `BlockSchema` (ENV-60) and renders the matching form controls, so a
custom block gets a properties form for free. Edits mutate the **one** document model
through ENV-11 immutable ops (never direct DOM/node mutation), keeping the doc the
single source of truth. Chrome, so themed by `--eb-*` and Shadow DOM, not the canvas.

## Goal
A Lit component `<eb-properties-panel>` renders form controls generated from the
selected block's schema and writes every edit back to the doc via ENV-11 ops, themed
entirely with `--eb-*`.

## Prerequisites
- ENV-60 done (`BlockSchema`, `FieldDef`, `FieldType`, `blockRegistry`).
- ENV-11 done (immutable update / `setNodeProps`-style ops that produce a new doc +
  patch). The panel calls these; it does not mutate nodes in place.
- ENV-30 (`<enveloppe-editor>` shell — `part="properties"` mount + theming pattern).
- A selection signal: which `NodeId` is selected (from ENV-40/canvas selection). If
  selection isn't landed yet, accept the selected node id as a property and document
  the wiring point.

## Implementation notes
Create under `packages/core/src/properties/`:

1. **`properties-panel.ts`** — `EbPropertiesPanel extends LitElement`
   (`eb-properties-panel`):
   ```ts
   @property({ attribute: false }) doc!: EnveloppeDoc;
   @property({ attribute: false }) selectedId: NodeId | null = null;
   // emits `eb-doc-change` { detail: { doc, patch } } when a field edits the doc
   ```
   - Resolve the selected node from `doc` by id; look up its `BlockDefinition` via
     `blockRegistry.get(node.type)`; render the schema's fields grouped by `field.group`
     (collapsible sections: "Layout", "Spacing", "Colors", block-specific).
   - Empty state when nothing is selected ("Select a block to edit").
2. **`fields/` — one Lit control per `FieldType`**, all themed via `--eb-*`:
   `eb-field-text`, `eb-field-number`, `eb-field-color`, `eb-field-select`,
   `eb-field-boolean`, `eb-field-spacing` (T/R/B/L group), `eb-field-align`
   (left/center/right toggle), `eb-field-url`. (`richtext` is edited inline on canvas,
   not here — render a hint, not an editor.) Each control:
   - reads its current value from the node via the field's `key` dot-path
     (`getByPath(node, "style.paddingTop")`),
   - on input, emits the new value up to the panel.
3. **Edit → doc op.** The panel translates a field change into an ENV-11 immutable
   update keyed by `selectedId` + `field.key` dot-path, e.g.
   `setNodeProp(doc, selectedId, "style.paddingTop", 12) → { doc, patch }`, then
   dispatches `eb-doc-change`. The editor applies it (so undo/redo via patch diffs
   works for property edits too). **Debounce** rapid inputs (color/number drags) to one
   doc op per idle frame to protect the perf budget and keep undo history sane.
4. **Columns control.** The Section block's column-count field adds/removes
   `ColumnNode` children and re-distributes `widthPercent` to sum to 100 (ENV-10
   invariant) — implement as a dedicated op the section field calls. Per-column width
   is editable on the selected column.
5. **Theming.** All controls use `--eb-color-*`, `--eb-radius`, `--eb-font-ui`, spacing
   tokens (ENV-34). No host-CSS reads; Shadow DOM only. Match the chrome look from
   `spikes/od2-toolchain/src/themed-panel.ts`.
6. **Mount** into the shell's `part="properties"` slot; wire `doc`/`selectedId` from
   the editor and listen for `eb-doc-change`.
7. **Budget** — Lit + small controls; no heavy form lib. Reuse Lit's templating; no new
   runtime dep.

## Acceptance criteria
- [ ] `<eb-properties-panel>` renders a form generated from the selected block's
      `schema.fields`, grouped by `field.group`.
- [ ] Each `FieldType` has a working control; current values are read from the node via
      the field `key` dot-path.
- [ ] Editing a field emits `eb-doc-change` carrying a **new** doc + patch produced by
      ENV-11 ops (no in-place node mutation); undo/redo therefore covers property edits.
- [ ] Rapid input is debounced to bounded doc ops per frame.
- [ ] The Section column-count control adds/removes columns and keeps widths summing
      to 100 (round-trips `validateDoc`).
- [ ] All controls are themed via `--eb-*`; no host CSS reaches them (Shadow DOM).
- [ ] Empty state shows when nothing is selected.
- [ ] Unit tests cover schema→fields generation, value read/write by path, the
      doc-op emission, and the columns op (`bun test`); a Playwright test edits a field
      and asserts the canvas updates (chromium + webkit).

## Out of scope
- The block schemas themselves (ENV-60/61) — the panel consumes them.
- Inline rich-text editing (ENV-50/52) — `richtext` fields are edited on canvas.
- Selection mechanics on the canvas (ENV-40) — panel consumes a selected id.
- Token picker (ENV-71).

## Verification
```bash
cd packages/core
bun test
bun run build
bun run lint
bun run e2e  # chromium + webkit: select a block, change padding/color, canvas reflects it
```

## Definition of done
See `_conventions.md`. Schema-driven panel mutates the doc via ENV-11; themed by
`--eb-*`; size gate green; status → `review`.
