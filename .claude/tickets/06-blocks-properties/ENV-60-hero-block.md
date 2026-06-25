---
id: ENV-60
title: Hero block (background image + overlay CTA)
status: done
priority: P1
milestone: 6 — Blocks & properties
depends_on: [ENV-34, ENV-33]
blocks: []
package: core
prd: [§12]
estimate: M
---

# ENV-60 — Hero block (background image + overlay CTA)

## Context
A hero is the full-width banner at the top of most marketing emails: a background image
with an overlaid heading, subtext, and a call-to-action button. It ships through the
**same** `registerBlock` path as the core blocks (ENV-34) — no special-case path. MJML
has a native `<mj-hero>` element, so export maps cleanly, but background-image support in
email clients is uneven (Outlook in particular), so the block must always carry a solid
fallback color.

## Goal
A registered `hero` block that paints a background-image banner with overlaid
heading/subtext/CTA on the canvas and exports a native `<mj-hero>`.

## Prerequisites
- ENV-34 done (the core-block patterns: `BlockDefinition` shape, `applyStyle`, the MJML
  mapping conventions, schema/palette conventions, factory-aligned defaults).
- ENV-33 done (`registerBlock`, `BlockDefinition`, `BlockSchema`/`FieldDef`, render
  contexts).
- The host `onImageUpload` callback convention (same one the Image block uses) for the
  background image; the href normalizer for the CTA.
- ENV-05 node types — if the doc model needs a `hero` node type, add it minimally and
  update `validateDoc`.

## Implementation notes
Create `packages/rime-core/src/blocks/core/hero.ts`, exporting a `BlockDefinition`, and
register it from `registerCoreBlocks()` (ENV-34).

1. **Node type** `"hero"`.
2. **Node shape / props.**
   ```ts
   // block props: {
   //   backgroundImage?: string;      // url, set via onImageUpload
   //   backgroundColor: string;       // solid fallback (always present)
   //   heading: string;
   //   subtext?: string;
   //   button?: { label: string; href: string };
   //   height: number;                // px
   //   textColor?: string;
   //   style: BlockStyle;             // align etc.
   // }
   ```
3. **`schema`.** Fields:
   | key | type | group |
   |-----|------|-------|
   | `backgroundImage` | `url` (with `onImageUpload`) | Content |
   | `backgroundColor` | `color` (fallback) | Colors |
   | `heading` | `text` | Content |
   | `subtext` | `text` (optional) | Content |
   | `button.label` / `button.href` | `text` / `url` | Content |
   | `height` | `number` (px) | Layout |
   | `textColor` | `color` | Colors |
   | `style.align` | `align` | Layout |
4. **`renderCanvas`.** A positioned container with `background-image` (falling back to
   `backgroundColor`), fixed `height`, and overlaid heading/subtext/CTA centered per
   `align` in `textColor`. Stamp `data-node-id`; reuse `applyStyle`. No table.
5. **`renderExport`.** Native MJML — `<mj-hero>`:
   `{ mjml: "<mj-hero mode=\"fixed-height\" height=\"${height}px\" background-url=\"${escapeAttr(backgroundImage)}\" background-color=\"${backgroundColor}\" ...><mj-text>…heading/subtext…</mj-text><mj-button href=…>…</mj-button></mj-hero>" }`.
   Use `mode`/`background-url`/`background-color`/`height` attributes. **Always emit
   `background-color`** as the fallback. Validate the CTA href via the shared normalizer
   (reject `javascript:`); escape all text/attrs; omit the button when unset.
6. **Outlook caveat (document it).** Background-image rendering varies across clients and
   Outlook/Windows often drops it — the solid `backgroundColor` fallback and readable
   `textColor` must keep the hero legible with no image. Note this in the ticket and a
   code comment.
7. **`palette`.** `{ label: "Hero", icon: "🏞", category: "Content",
   defaults: { backgroundColor: "#333333", heading: "Big headline", height: 300,
   textColor: "#ffffff", style: { align: "center" } } }`.
8. **Budget** — pure DOM/string building, no new runtime dep.

## Acceptance criteria
- [ ] A `hero` block is registered via `registerBlock` (same path as core blocks).
- [ ] `renderCanvas` paints a fixed-height banner with background image (or color
      fallback) and overlaid heading/subtext/CTA; `data-node-id` present; no `<table>`.
- [ ] `renderExport` emits `<mj-hero>` with `mode`/`height`/`background-url` and an
      always-present `background-color` fallback; output compiles via the MJML renderer.
- [ ] The CTA href is normalized/validated (rejects `javascript:`); button omitted when
      unset.
- [ ] Background image is set via the host `onImageUpload` callback (same as the Image
      block).
- [ ] Outlook / background-image caveat documented (ticket + code comment); hero stays
      legible with no image.
- [ ] Dropped-block defaults round-trip through `validateDoc` as valid.
- [ ] Unit tests cover schema, canvas DOM, `<mj-hero>` export (fallback color present),
      and href validation (`bun test`).

## Out of scope
- Video backgrounds and animated/parallax heroes.
- Multiple stacked CTAs or form fields inside the hero.

## Verification
```bash
cd packages/rime-core
bun test
bun run build
bun run lint
```

## Definition of done
See `_conventions.md`. Hero block ships via the public block path; native `<mj-hero>`
export with color fallback; size gate green; status → `review`.
