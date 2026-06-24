---
id: ENV-65
title: Schema field-type extensions (list/repeater + multiline/code)
status: done
priority: P1
milestone: 6 — Blocks & properties
depends_on: [ENV-33]
blocks: [ENV-59, ENV-62, ENV-63, ENV-64]
package: core
prd: [§6.8]
estimate: S
---

# ENV-65 — Schema field-type extensions

## Context
The block schema DSL (`FieldDef`/`FieldType` in `packages/rime-core/src/blocks/schema.ts`,
ENV-33) covers single-value fields only. Several new blocks need richer prop editing:
the Menu (ENV-59), Video (ENV-63), and Table (ENV-64) blocks edit a **list of rows**
(repeater), and the HTML block (ENV-62) edits a **multiline/code** string. Adding these
field types once here prevents three tickets re-inventing the same thing and keeps the
properties panel (ENV-35) form-rendering consistent.

## Goal
The schema DSL gains a `"list"` (repeater) field type — an ordered set of rows, each a
sub-schema of fields, with add/remove/reorder — and a `"multiline"`/`"code"` field type,
both serializable and renderable by the properties panel.

## Prerequisites
- ENV-33 done (`FieldDef`, `FieldType`, `BlockSchema`).
- Coordinate with ENV-35 (properties panel) so it can render the new types; this ticket
  defines the data shape, ENV-35 renders the controls.

## Implementation notes
Edit `packages/rime-core/src/blocks/schema.ts`:

1. **Multiline/code field.** Add `"multiline"` (and/or `"code"`) to `FieldType`. It's a
   plain string value like `"text"` but the properties panel renders a `<textarea>` (and
   a monospace variant for `"code"`). No new value shape.
2. **List / repeater field.** Add `"list"` to `FieldType` and a way to describe each
   row's fields. Keep it serializable:
   ```ts
   export interface FieldDef {
     // ...existing...
     // For type: "list" — the schema of each row.
     itemFields?: FieldDef[];
     // Optional caps for the repeater.
     minItems?: number;
     maxItems?: number;
   }
   ```
   The edited value for a `"list"` field is `Array<Record<string, unknown>>` (one object
   per row keyed by `itemFields[].key`). Document this in the type.
3. **Keep it minimal + serializable.** No functions in the schema; it must stay
   JSON-describable (it drives a declarative form). Nesting a `"list"` inside a `"list"`
   is out of scope unless trivially free.
4. **Types only here.** The properties-panel *rendering* of these controls is ENV-35;
   this ticket exports the shapes and adds unit coverage that a schema using them is
   well-formed.

## Acceptance criteria
- [ ] `FieldType` includes `"multiline"` (and/or `"code"`) and `"list"`.
- [ ] `FieldDef` supports `itemFields` (+ `minItems`/`maxItems`) for `"list"`; the row
      value shape (`Array<Record<string, unknown>>`) is documented.
- [ ] The additions are pure types/data — serializable, no DOM, no engine import.
- [ ] Unit tests assert example schemas (a menu's `items` list, an HTML block's `code`
      field) type-check and have the expected structure.
- [ ] No `any` in the public schema types; exported from `src/index.ts`.

## Out of scope
- Rendering the controls in the properties panel (ENV-35).
- The blocks that consume these (ENV-59/62/63/64).
- Arbitrarily nested repeaters.

## Verification
```bash
cd packages/rime-core
bun test     # example list/multiline schemas are well-formed
bun run build
bun run lint
```

## Definition of done
See `_conventions.md`. `list` + `multiline`/`code` field types added to the schema DSL,
serializable and documented, with unit coverage; status → `review`.
