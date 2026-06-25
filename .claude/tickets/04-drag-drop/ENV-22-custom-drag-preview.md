---
id: ENV-22
title: Custom drag preview
status: done
priority: P1
milestone: 4 — Drag & drop
depends_on: [ENV-19]
blocks: []
package: core
prd: [§6.6]
estimate: S
---

# ENV-22 — Custom drag preview

> **Implemented per OD-6 (pointer DnD), not Pragmatic.** With pointer-event
> dragging there is no native HTML5 drag image to replace, so instead of
> Pragmatic's `setCustomNativeDragPreview` we render a themed card and move it to
> follow the pointer, removing it on drag end. All acceptance criteria
> (branded/themed preview, pointer offset, cleanup) are met.

## Context
Pragmatic drag-and-drop offers a custom drag-preview API; the default browser
preview (a translucent clone of the source element) looks unpolished and, for a
palette item, would show the palette chip rather than the block being created.
For the "cleaner skin" the PRD sells (§6.6, §2), the thing the user drags should
look like a small, branded card that matches the builder design and reads as
"this block". This is a small, self-contained UI ticket on top of ENV-19's wiring.

## Goal
Dragging any palette item or canvas block shows a custom, `--rime-*`-themed preview
(icon + label) instead of the default browser ghost, in Chromium + WebKit.

## Prerequisites
- ENV-19 done (`DndController`, `DragData`, palette + canvas draggables).
- `--rime-*` theme tokens (ENV-18) for styling.

## Implementation notes
Create under `packages/core/src/dnd/`:

1. **`drag-preview.ts`** — use Pragmatic's preview hook on the `draggable`
   config:
   ```ts
   import { setCustomNativeDragPreview }
     from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
   import { pointerOutsideOfPreview }
     from "@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview";

   // In the draggable's onGenerateDragPreview:
   onGenerateDragPreview({ nativeSetDragImage }) {
     setCustomNativeDragPreview({
       nativeSetDragImage,
       getOffset: pointerOutsideOfPreview({ x: "8px", y: "8px" }),
       render({ container }) {
         const card = renderPreviewCard(data); // returns an <rime-drag-preview> / element
         container.appendChild(card);
         return () => card.remove(); // cleanup
       },
     });
   }
   ```
2. **`<rime-drag-preview>`** — a tiny Lit component (or plain element) showing the
   block's palette icon + label. Pull the icon/label from the block's palette
   metadata for `DragData.source === "palette"`, or the block type for an existing
   canvas block. Styled exclusively from tokens:
   `background: var(--rime-color-surface)`, `color: var(--rime-color-fg)`,
   `border-radius: var(--rime-radius)`, `box-shadow: var(--rime-shadow-1)`,
   `font: var(--rime-font-ui)`.
3. **Cleanup** — the `render` return MUST remove the preview element; verify no
   detached preview nodes accumulate across repeated drags (ENV-26 territory, but
   keep it clean here).
4. **WebKit note** — custom native drag previews historically render differently
   on Safari; the Playwright check should assert the preview element is created +
   themed in both engines (screenshot or DOM presence), tolerating sub-pixel
   rendering differences.

## Acceptance criteria
- [ ] Dragging a palette item shows the custom themed preview (icon + label of
      that block), not the default browser ghost.
- [ ] Dragging an existing canvas block shows a custom preview for that block.
- [ ] The preview is styled only via `--rime-*` tokens (no hard-coded colors).
- [ ] The preview offsets slightly from the pointer (not under the cursor).
- [ ] The preview element is cleaned up after each drag (no detached nodes).
- [ ] Works in Chromium + WebKit.

## Out of scope
- Drop indicators (ENV-20), perf budget (ENV-21), keyboard/a11y (ENV-23/45).
- Palette icon/label registration shape (ENV-36) — consume whatever metadata the
  palette exposes; if absent, use a placeholder icon + the block type as label.

## Verification
```bash
cd packages/core
bun test     # renderPreviewCard returns themed element with correct icon/label per DragData
bun run build
bun run lint
bun run e2e  # chromium + webkit: custom preview element present + themed while dragging; cleaned up after
```

## Definition of done
See `_conventions.md`. Branded drag preview live, cross-browser; status → `review`.
