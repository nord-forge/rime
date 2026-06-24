---
id: ENV-34
title: Core blocks (Section, Column, Text, Image, Button, Divider, Spacer)
status: ready
priority: P0
milestone: 6 — Blocks & properties
depends_on: [ENV-33]
blocks: [ENV-38, ENV-43, ENV-46]
package: core
prd: [§12]
estimate: L
---

# ENV-34 — Core blocks via registerBlock

## Context
These are the v1 "done-bar" blocks (§12): Section, Column(s), Text, Image, Button,
Divider, Spacer. The whole point of ENV-33 is that built-ins ship through the **same**
`registerBlock` path as third-party blocks — so this ticket implements each core block
as a `BlockDefinition` (schema + palette + renderCanvas + renderExport) and registers
them, with no internal shortcut. This is also the reference every custom block (ENV-37)
imitates.

## Goal
`@nord-forge/rime-core` registers the seven core blocks through `registerBlock`, each with a
schema (drives ENV-35), palette entry (feeds ENV-36), canvas renderer (paints into the
ENV-15 iframe), and export renderer (emits MJML matching ENV-11), wired by a single
`registerCoreBlocks()` the editor calls on init.

## Prerequisites
- ENV-33 done (`registerBlock`, `BlockDefinition`, `BlockSchema`/`FieldDef`,
  `PaletteEntry`, canvas/export render contexts).
- ENV-05 node types (`SectionNode`/`ColumnNode`/`TextBlock`/`ImageBlock`/`ButtonBlock`/
  `DividerBlock`/`SpacerBlock`, `BlockStyle`, `RichTextJSON`) and factory helpers.
- ENV-16 (`applyStyle`, the divs/flex canvas conventions — reuse, don't re-invent).
- ENV-11 (the MJML mapping table + `styleToMjmlAttrs` — mirror it for core export).

## Implementation notes
Create under `packages/core/src/blocks/core/` — **one file per block**, each exporting
a `BlockDefinition`, plus a barrel `index.ts` with `registerCoreBlocks()`.

1. **Per-block definition pattern** (e.g. `text.ts`):
   ```ts
   import type { BlockDefinition } from "../types";
   import type { TextBlock } from "@nord-forge/rime-model";

   export const textBlock: BlockDefinition<TextBlock> = {
     type: "text",
     palette: { label: "Text", icon: "🅣", category: "Content",
       defaults: { content: emptyRichText(), style: {} } },
     schema: { fields: [
       { key: "style.align", label: "Align", type: "align", group: "Layout" },
       { key: "style.paddingTop", label: "Padding", type: "spacing", group: "Spacing" },
       { key: "style.backgroundColor", label: "Background", type: "color", group: "Colors" },
     ]},
     renderCanvas: (n, ctx) => { /* divs, applyStyle, paint RichTextJSON (read-only) */ },
     renderExport: (n) => ({ mjml: `<mj-text ...>${richTextToInlineHtml(n.content)}</mj-text>` }),
   };
   ```
2. **The seven blocks** — schema/canvas/export per block:
   | block | key schema fields | canvas | export |
   |-------|-------------------|--------|--------|
   | `section` | spacing, backgroundColor; **column-count** control (1/2/3) | block container, `applyStyle` | `<mj-section>` wrapping columns |
   | `column` | width%, spacing, backgroundColor, vertical-align | flex child, `flex-basis: widthPercent%` | `<mj-column width="N%">` |
   | `text` | align, spacing, backgroundColor | rich text (read-only paint) | `<mj-text>` + `richTextToInlineHtml` |
   | `image` | src(url), alt, href(url), align, width, spacing | `<img>` | `<mj-image src alt href? />` |
   | `button` | label, href(url), bg/text color, radius, align, spacing | styled `<a>` | `<mj-button href>` |
   | `divider` | color, thickness, spacing | `<hr>`-style div | `<mj-divider />` |
   | `spacer` | height(number) | empty div, fixed block-size | `<mj-spacer height="Npx" />` |
   - **Section/columns:** the section's column-count control mutates the doc by
     adding/removing `ColumnNode` children (via ENV-06 ops in ENV-35); the block here
     just renders whatever columns exist and declares the schema field. Columns in a
     section sum to 100% (ENV-05 invariant) — when count changes, distribute evenly.
   - **Canvas = divs/flex, never tables** (§6.2). **Export = MJML** mirroring ENV-11.
3. **Stay DRY with ENV-11.** Core export handlers must produce MJML identical to
   ENV-11's hardcoded mapping for the same node. Import the shared
   `styleToMjmlAttrs`/`richTextToInlineHtml` from `@nord-forge/rime-mjml` (or a
   shared util) rather than duplicating — document the single source. ENV-11's
   standalone handlers remain the renderer's default; these registry handlers are the
   SDK-path equivalent and MUST match for core types (assert parity in tests).
4. **`registerCoreBlocks()`** in `core/index.ts` registers all seven on the default
   `blockRegistry`. The editor calls it once at module init (idempotent guard so a
   double-import doesn't throw). Respect `config.enabledBlocks` at the palette layer
   (ENV-36), not by skipping registration.
5. **Defaults via factory.** `palette.defaults` should align with ENV-05's factory
   helpers (`createSection()`, etc.) so a dropped block is immediately valid.
6. **Export** the block definitions and `registerCoreBlocks` from `src/index.ts`.
7. **Budget** — pure DOM/string building, no new runtime dep. Hot-path canvas code:
   keep `renderCanvas` allocation-light.

## Acceptance criteria
- [ ] All seven core blocks are defined as `BlockDefinition`s and registered via
      `registerBlock` (no internal special-case path; `blockRegistry.get("text")` etc.
      all resolve).
- [ ] Each block's `renderCanvas` produces divs/flex DOM with `data-node-id` and
      applied `BlockStyle`; columns lay out side-by-side; **no `<table>`** on canvas.
- [ ] Each block's `renderExport` emits MJML matching ENV-11's mapping for the same
      node (parity asserted in a test).
- [ ] Each block's `schema` drives a sensible properties form (fields cover padding,
      colors, alignment, columns/width, and block-specific props per the table).
- [ ] `registerCoreBlocks()` is idempotent and registers exactly the seven types.
- [ ] Palette entries provide icon/label/category/defaults; dropped-block defaults
      round-trip through `validateDoc` as valid.
- [ ] Unit tests cover schema, canvas DOM, export MJML, and ENV-11 parity per block
      (`bun test`). Core bundle within budget.

## Out of scope
- Social block (ENV-38) — separate, P2. The properties-panel UI (ENV-35) and palette
  UI (ENV-36) — these supply schema/palette data only.
- `onImageUpload` wiring for the image block (ENV-43) — image takes a plain `src` here.
- Merge tokens in text (ENV-39).

## Verification
```bash
cd packages/core
bun test     # per block: schema, canvas DOM (no table), export MJML, ENV-11 parity
bun run build
bun run lint
bun run e2e  # chromium + webkit: drop each block type, canvas shows it
```

## Definition of done
See `_conventions.md`. Seven core blocks registered via the public path; export
matches ENV-11; size gate green; status → `review`.
