---
id: ENV-37
title: Example custom block (the SDK proof)
status: done
priority: P1
milestone: 6 — Blocks & properties
depends_on: [ENV-33]
blocks: [ENV-51]
package: core
prd: [§12]
estimate: S
---

# ENV-37 — Example custom block (the SDK proof)

## Context
The v1 done-bar requires "the `registerBlock` SDK documented, with one example custom
block" (§12). This is the **proof** that a third-party developer can add a block end
to end using only the public `registerBlock` path — schema → properties form, canvas
preview, MJML export, palette entry — with **zero** access to core internals. It
doubles as the canonical copy-paste template the docs (ENV-51) reference. The example
must NOT live in `@nord-forge/rime-core`'s shipped bundle (it's a sample, not a built-in).

## Goal
A fully-documented example custom block (e.g. a "Coupon" block) implemented purely via
`registerBlock`, placed where the demo/docs consume it, proving the SDK works without
internal imports.

## Prerequisites
- ENV-33 done (`registerBlock`, `BlockDefinition`, schema/palette/render contexts —
  all imported from the package public entry, never deep paths).
- The README `registerBlock` example is the API shape to match.

## Implementation notes
1. **Location.** Put the example under `apps/demo/src/blocks/coupon-block.ts` (or a
   dedicated `examples/` dir) — **not** in `packages/core/src`. It must import only
   from the package public entry:
   ```ts
   import { registerBlock } from "@nord-forge/rime-core";
   // NO deep imports like "@nord-forge/rime-core/src/..." — public surface only.
   ```
2. **The block** — a "Coupon" block (a marketing block MJML can't fully express, so it
   also exercises the raw-table fallback path):
   ```ts
   registerBlock({
     type: "coupon",
     palette: { label: "Coupon", icon: "🎟️", category: "Marketing",
       defaults: { code: "SAVE10", label: "10% off", style: {} } },
     schema: { fields: [
       { key: "label", label: "Headline", type: "text", group: "Content" },
       { key: "code",  label: "Coupon code", type: "text", group: "Content" },
       { key: "style.backgroundColor", label: "Background", type: "color", group: "Colors" },
       { key: "style.paddingTop", label: "Padding", type: "spacing", group: "Spacing" },
     ]},
     renderCanvas: (n, ctx) => { /* dashed-border coupon card, applyStyle, data-node-id */ },
     // raw-table fallback: returns { raw } so ENV-12 passes it through verbatim
     renderExport: (n, ctx) => ({ raw: couponTableHtml(n, ctx.escape) }),
   });
   ```
   - `renderCanvas`: a styled coupon card (dashed border, code chip). Stamp
     `data-node-id` (use the same pattern core blocks use).
   - `renderExport`: emit a **raw email-safe `<table>`** (the ENV-12 fallback) since a
     coupon ticket isn't a clean MJML primitive — demonstrating both export modes exist.
   - Escape all interpolated text via `ctx.escape`.
3. **Heavy inline documentation.** This file is a teaching artifact: comment every part
   (what schema drives, why renderCanvas vs renderExport differ, when to use `raw`).
   The docs site (ENV-51) embeds it; keep it self-explanatory.
4. **Consume it.** Register the example in the demo app (ENV-46) so it actually appears
   in the palette, gets a properties form from its schema, renders on canvas, and
   exports — i.e. exercised through the real editor, not just unit-tested.
5. **No core changes.** If implementing this requires reaching into core internals, that
   is a **bug in ENV-33's public surface** — fix the export there, do not add a
   workaround here. That tension is exactly what this ticket exists to surface.

## Acceptance criteria
- [ ] A documented example custom block exists outside `packages/core/src`, importing
      only `@nord-forge/rime-core`'s public entry (no deep/internal imports).
- [ ] Registering it makes it appear in the palette, produce a schema-driven properties
      form, render on canvas (with `data-node-id`), and export to email-safe HTML.
- [ ] `renderExport` uses the `{ raw }` raw-table path (exercising ENV-12), with all
      text escaped.
- [ ] The example is registered/used by the demo app and works end to end there.
- [ ] Heavy inline comments make it usable as the docs (ENV-51) reference template.
- [ ] If anything needed a non-public import, ENV-33's public surface was fixed instead.

## Out of scope
- Shipping this block inside `@nord-forge/rime-core` (it's a sample, not a built-in).
- The docs site itself (ENV-51) — this just supplies the canonical example.
- Social block (ENV-38).

## Verification
```bash
# from repo root
bun test          # a unit test registers the example and asserts palette/export shape
bun run build
bun run lint
# in the demo: the Coupon block appears in the palette and exports a <table>
```

## Definition of done
See `_conventions.md`. A public-API-only example block works end to end via the demo;
status → `review`.
