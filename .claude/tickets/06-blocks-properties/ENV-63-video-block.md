---
id: ENV-63
title: Video block (poster + play overlay link)
status: done
priority: P2
milestone: 6 — Blocks & properties
depends_on: [ENV-34, ENV-33]
blocks: []
package: core
prd: [§12]
estimate: M
---

# ENV-63 — Video block (poster + play overlay link)

## Context
Email clients can't embed playable video, so the standard pattern is a poster/thumbnail
image with a play-button overlay that links out to the hosted video URL. This block ships
through the **same** `registerBlock` path as the core blocks (ENV-34) — no special-case
path. The play overlay composited over an image is hard to express with a native MJML
component, so export uses the raw-table fallback (or an `<mj-image>` wrapped in a link) —
noted below.

## Goal
A registered `video` block that paints a poster thumbnail with a play-button overlay
linking to the hosted video URL on the canvas, and exports a linked poster image.

## Prerequisites
- ENV-34 done (the core-block patterns: `BlockDefinition` shape, `applyStyle`, the MJML
  mapping conventions, schema/palette conventions, factory-aligned defaults).
- ENV-33 done (`registerBlock`, `BlockDefinition`, `BlockSchema`/`FieldDef`, the `{ mjml }`
  and `{ raw }` export-output paths).
- The host `onImageUpload` callback (same as the Image block) for the poster; the href
  normalizer for the video URL.
- ENV-05 node types — if the doc model needs a `video` node type, add it minimally and
  update `validateDoc`.

## Implementation notes
Create `packages/rime-core/src/blocks/core/video.ts`, exporting a `BlockDefinition`, and
register it from `registerCoreBlocks()` (ENV-34).

1. **Node type** `"video"`.
2. **Node shape / props.**
   ```ts
   // block props: {
   //   posterImage?: string;   // url, set via onImageUpload
   //   videoUrl: string;       // href to the hosted video
   //   alt: string;
   //   style: BlockStyle;      // align etc.
   // }
   ```
3. **`schema`.** Fields:
   | key | type | group |
   |-----|------|-------|
   | `posterImage` | `url` (with `onImageUpload`) | Content |
   | `videoUrl` | `url` | Content |
   | `alt` | `text` | Content |
   | `style.align` | `align` | Layout |
   | `style.paddingTop` (+ R/B/L) | `spacing` | Spacing |
   - (Note: unlike ENV-59/ENV-64 this block needs no array field — its props are flat.)
4. **`renderCanvas`.** The poster `<img>` (or color placeholder when unset) with a
   centered play-button badge overlaid (a positioned `<div>`/SVG triangle), the whole
   thing an `<a>` to `videoUrl`. Honor align; stamp `data-node-id`; reuse `applyStyle`.
5. **`renderExport`.** A **linked poster image with a play overlay**. Two viable
   approaches — pick and document one:
   - **`<mj-image>` wrapped in a link** (`<mj-image href=… src=poster />`) — cleanest, but
     a true overlaid play badge composited on the image isn't expressible; rely on a
     poster that already bakes in a play badge, OR
   - **raw-table fallback** (`{ raw }`): a linked `<table>`/`<a>` with the poster as
     background/`<img>` and an absolutely/centered play graphic over it, for an explicit
     overlay independent of the poster.
   Default to the raw-table fallback when a separate overlay graphic is required; note the
   trade-off in the ticket + code. **Validate `videoUrl`** via the shared href normalizer
   (reject `javascript:`); escape `alt` and all attrs/urls.
6. **`palette`.** `{ label: "Video", icon: "▶", category: "Content",
   defaults: { videoUrl: "#", alt: "Video", style: {} } }`.
7. **Budget** — pure DOM/string building, inline SVG play badge (no icon dep), no network
   fetch.

## Acceptance criteria
- [ ] A `video` block is registered via `registerBlock` (same path as core blocks).
- [ ] `renderCanvas` paints the poster (or placeholder) with a centered play-button
      overlay, the whole linking to `videoUrl`; `data-node-id` present.
- [ ] `renderExport` emits a linked poster image with a play overlay via the chosen
      approach (`<mj-image>`+link or `{ raw }` table); the approach + trade-off is
      documented; output compiles via the MJML renderer.
- [ ] `videoUrl` is normalized/validated via the shared href normalizer; `javascript:`
      rejected; `alt` and urls escaped.
- [ ] Poster image set via the host `onImageUpload` callback (same as the Image block).
- [ ] Dropped-block defaults round-trip through `validateDoc` as valid.
- [ ] Unit tests cover schema, canvas DOM (overlay + link), export output, and href
      validation (`bun test`).

## Out of scope
- Actual in-email video playback (impossible in email — out of scope by definition).
- Auto-generating a poster/thumbnail from the video URL (host provides the poster).
- Provider-specific embeds (YouTube/Vimeo APIs).

## Verification
```bash
cd packages/rime-core
bun test
bun run build
bun run lint
```

## Definition of done
See `_conventions.md`. Video block ships via the public block path; linked-poster export
with documented approach; href validated; size gate green; status → `review`.
