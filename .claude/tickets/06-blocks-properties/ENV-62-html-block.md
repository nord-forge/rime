---
id: ENV-62
title: HTML / Code block (raw passthrough)
status: ready
priority: P2
milestone: 6 — Blocks & properties
depends_on: [ENV-34, ENV-33]
blocks: []
package: core
prd: [§12]
estimate: S
---

# ENV-62 — HTML / Code block (raw passthrough)

## Context
An advanced escape hatch for power users: the author supplies raw HTML that passes
through to the export verbatim. It ships through the **same** `registerBlock` path as the
core blocks (ENV-34) — no special-case path. MJML has `<mj-raw>` for exactly this, so
export is a passthrough on the raw-table fallback path. The content is **host-authored
and trusted** (unlike pasted clipboard HTML, which is sanitized elsewhere) — that trust
boundary must be documented, not silently assumed.

## Goal
A registered `html` block that takes raw HTML, previews it in a contained way on the
canvas, and exports it verbatim through `<mj-raw>`.

## Prerequisites
- ENV-34 done (the core-block patterns: `BlockDefinition` shape, `applyStyle`, the MJML
  mapping conventions, schema/palette conventions, factory-aligned defaults).
- ENV-33 done (`registerBlock`, `BlockDefinition`, `BlockSchema`/`FieldDef`, the
  `{ raw }` export-output path).
- ENV-05 node types — if the doc model needs an `html` node type, add it minimally and
  update `validateDoc`.

## Implementation notes
Create `packages/rime-core/src/blocks/core/html.ts`, exporting a `BlockDefinition`, and
register it from `registerCoreBlocks()` (ENV-34).

1. **Schema gap (shared work).** The author needs a multiline/code editing field. The
   schema DSL (`FieldDef` in `schema.ts`) currently has only single-line `text`. Add a
   `"code"` (or `"multiline"`) `FieldType` to `schema.ts` (a multiline textarea, ideally
   monospace) — this is **shared** with any future multiline need. Flag it as a first
   implementation step.
2. **Node type** `"html"`.
3. **Node shape / props.**
   ```ts
   // block props: { html: string; style: BlockStyle }
   ```
4. **`schema`.** A single `html` field of the new `code`/`multiline` type, plus spacing.
5. **`renderCanvas`.** Render the supplied HTML for preview in a **contained** way — set
   it into a wrapper element and stamp `data-node-id`. Document the trust boundary in a
   code comment: this is host-authored, trusted content (the editor is a trusted authoring
   surface), NOT untrusted paste — so it is intentionally not sanitized here. Keep the
   preview visually contained (a bordered wrapper) so it cannot silently bleed into editor
   chrome; the canvas is already an isolated `srcdoc` iframe. No table required by the
   block itself.
6. **`renderExport`.** Raw-table fallback path — passthrough via `<mj-raw>`:
   `{ raw: "<mj-raw>" + html + "</mj-raw>" }` (the `html` string is emitted verbatim, NOT
   escaped — that is the whole point of the block). Use the `{ raw }` export output so the
   renderer routes it through the passthrough path.
7. **`palette`.** `{ label: "HTML", icon: "</>", category: "Advanced",
   defaults: { html: "<!-- your HTML -->", style: {} } }`.
8. **Budget** — pure DOM/string handling, no new runtime dep.

## Acceptance criteria
- [ ] `schema.ts` gains a `code`/`multiline` `FieldType` (shared work) for editing the
      raw HTML.
- [ ] An `html` block is registered via `registerBlock` (same path as core blocks).
- [ ] `renderCanvas` previews the supplied HTML in a contained wrapper with
      `data-node-id`.
- [ ] `renderExport` returns `{ raw }` wrapping the HTML in `<mj-raw>` **verbatim**
      (un-escaped); output compiles via the MJML renderer.
- [ ] The block is clearly documented (ticket + code comment) as advanced/trusted host
      content — explicitly NOT sanitized like pasted clipboard HTML; trust boundary
      stated.
- [ ] Dropped-block defaults round-trip through `validateDoc` as valid.
- [ ] Unit tests cover schema, contained canvas preview, and verbatim `<mj-raw>` export
      (`bun test`).

## Out of scope
- Sanitizing / linting / reformatting the author's HTML (it is trusted, passthrough).
- A syntax-highlighting code editor (a plain multiline field is enough for v1).
- MJML-component snippets (this block is raw HTML, not raw MJML).

## Verification
```bash
cd packages/rime-core
bun test
bun run build
bun run lint
```

## Definition of done
See `_conventions.md`. HTML block ships via the public block path; verbatim `<mj-raw>`
passthrough; trust boundary documented; size gate green; status → `review`.
