---
id: ENV-65
title: Social block (icons + links)
status: ready
priority: P2
milestone: 6 — Blocks & properties
depends_on: [ENV-61]
blocks: []
package: core
prd: [§12]
estimate: S
---

# ENV-65 — Social block (icons + links)

## Context
Social icons are the §12 stretch block: a row of social-network icons, each linking to
a profile URL. It is a P2 nice-to-have, implemented through the **same**
`registerBlock` path as the core blocks (ENV-61) — no special-case path. MJML has a
first-class `<mj-social>` element, so export is clean; the canvas paints a simple icon
row. Themed/styled within the doc model, exported via MJML.

## Goal
A registered `social` block listing configurable social links (network + URL), with a
schema-driven editor, an icon-row canvas preview, and `<mj-social>` export.

## Prerequisites
- ENV-61 done (the core-block patterns: `BlockDefinition` shape, `applyStyle`, the MJML
  mapping conventions, schema/palette conventions, factory-aligned defaults).
- ENV-10 may need a small node-type addition for `social` (a `links: { network; href }[]`
  array). If extending the doc model, do it minimally and update `validateDoc`; else
  carry the array in the block's props and document it.

## Implementation notes
Create `packages/core/src/blocks/core/social.ts` (kept with the other core blocks since
it ships built-in, just P2):

1. **Node shape.** A social block carries an ordered list of links:
   ```ts
   interface SocialLink { network: string; href: string; } // network ∈ a known set
   // block props: { links: SocialLink[]; style: BlockStyle; align?: ... }
   ```
   Known networks (v1): twitter/x, facebook, instagram, linkedin, youtube, github —
   each maps to an MJML-supported `name` and a built-in icon.
2. **`schema`.** A repeatable list field for links (network `select` + `url`), plus
   align/spacing/icon-size. If ENV-62 lacks a "list" field type, add a minimal
   `"list"` `FieldType` there or render the links via a small dedicated control and
   note the dependency; keep it simple (add/remove/reorder rows).
3. **`renderCanvas`.** An inline icon row (`<a><img>` per link) honoring align + size;
   stamp `data-node-id`; reuse `applyStyle`. Use inline SVG/emoji icons (no network
   fetch — keep it offline + budget-safe).
4. **`renderExport`.** `{ mjml: "<mj-social ...><mj-social-element name=... href=.../>…
   </mj-social>" }` — one `<mj-social-element>` per link; escape `href`. Map align/size
   to `<mj-social>` attributes.
5. **`palette`.** `{ label: "Social", icon: "🔗", category: "Content", defaults: { links:
   [twitter, instagram], style: {} } }`.
6. **Register** in `registerCoreBlocks()` (ENV-61) but allow it to be excluded via
   `config.enabledBlocks` (it's stretch).
7. **Budget** — inline icons only; no icon library dependency. No network calls.

## Acceptance criteria
- [ ] A `social` block is registered via `registerBlock` (same path as core blocks).
- [ ] Its schema lets users add/remove/reorder links (network + URL) and set
      align/icon-size; the properties panel renders it.
- [ ] `renderCanvas` paints an icon row with `data-node-id`; no `<table>` on canvas.
- [ ] `renderExport` emits `<mj-social>` with one `<mj-social-element>` per link, hrefs
      escaped; output compiles via the MJML renderer.
- [ ] Icons are inline (no network fetch, no icon-library runtime dep).
- [ ] Unit tests cover schema, canvas DOM, and `<mj-social>` export (`bun test`).

## Out of scope
- Custom/arbitrary network icons beyond the built-in set (could be a follow-up).
- The list-field control if it must be built in ENV-62 — coordinate, don't duplicate.

## Verification
```bash
cd packages/core
bun test
bun run build
bun run lint
```

## Definition of done
See `_conventions.md`. Social block ships via the public block path; size gate green;
status → `review`.
